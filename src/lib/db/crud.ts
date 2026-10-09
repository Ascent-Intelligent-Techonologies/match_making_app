import "server-only";
import { execute, maybeOne, one, query } from "@/lib/db/client";

/**
 * Table-agnostic CRUD.
 *
 * Every read and write in the data layer goes through one of the functions
 * below, so there is a single place where SQL is assembled, a single place
 * where values become bound parameters, and a single place to change if the
 * way we talk to Postgres ever changes again.
 *
 * Values are always bound, never interpolated. Column and table names are
 * checked against a strict identifier pattern, so a typo fails loudly instead
 * of quietly becoming valid SQL.
 *
 * The `columns`, `from`, `joins`, `groupBy` and `orderBy` options are raw SQL
 * fragments for the cases a generic builder cannot express — a lateral-join
 * aggregate, say. They are written by us, in this repository, and must never
 * be built from a request. Everything that comes from a user belongs in
 * `where`, which binds it.
 */

// ------------------------------------------------------------ conditions --

const COMPARISON = Symbol("comparison");

type Operator =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "in"
  | "overlaps"
  | "isNull"
  | "sql";

interface Comparison {
  [COMPARISON]: true;
  op: Operator;
  value?: unknown;
  values?: readonly unknown[];
  cast?: string;
  fragment?: string;
  params?: readonly unknown[];
}

function make(op: Operator, rest: Omit<Comparison, typeof COMPARISON | "op">): Comparison {
  return { [COMPARISON]: true, op, ...rest };
}

function isComparison(value: unknown): value is Comparison {
  return typeof value === "object" && value !== null && COMPARISON in value;
}

export const eq = (value: unknown) => make("eq", { value });
export const ne = (value: unknown) => make("ne", { value });
export const gt = (value: unknown) => make("gt", { value });
export const gte = (value: unknown) => make("gte", { value });
export const lt = (value: unknown) => make("lt", { value });
export const lte = (value: unknown) => make("lte", { value });
export const like = (value: string) => make("like", { value });
export const ilike = (value: string) => make("ilike", { value });
/** Matches any of these values. An empty list matches nothing, not everything. */
export const anyOf = (values: readonly unknown[], cast = "text") =>
  make("in", { values, cast });
/** Array column overlapping any of these values — Postgres `&&`. */
export const overlaps = (values: readonly unknown[], cast = "text[]") =>
  make("overlaps", { values, cast });
export const isNull = () => make("isNull", { value: true });
export const notNull = () => make("isNull", { value: false });
/** An escape hatch for one column. `?` marks each bound parameter. */
export const raw = (fragment: string, ...params: unknown[]) =>
  make("sql", { fragment, params });

/**
 * Column name to value, combined with AND. A bare value means equality, and
 * `null` means `is null` — writing `column = null` is a mistake Postgres
 * answers with silence rather than an error.
 *
 * Two reserved keys: `$or` takes a list of filters and ORs them together, and
 * `$raw` takes SQL fragments. Neither can collide with a column, because
 * column names may not start with `$`.
 */
export interface Filters {
  [column: string]: unknown;
  $or?: Filters[];
  $raw?: { sql: string; params?: unknown[] }[];
}

// A bare name, or one qualified by a table alias: `city`, `l.client_id`.
const IDENTIFIER = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/;

function checkIdentifier(name: string, what: string): void {
  // Table references may be aliased ("share_links l"), which is ours to write.
  const bare = name.split(/\s+/)[0];
  if (!IDENTIFIER.test(bare)) throw new Error(`Unsafe ${what}: ${name}`);
}

interface Binder {
  (value: unknown): string;
  params: unknown[];
}

function binder(params: unknown[]): Binder {
  const bind = ((value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  }) as Binder;
  bind.params = params;
  return bind;
}

function comparisonSql(column: string, cmp: Comparison, bind: Binder): string {
  switch (cmp.op) {
    case "eq":
      return cmp.value === null ? `${column} is null` : `${column} = ${bind(cmp.value)}`;
    case "ne":
      return cmp.value === null
        ? `${column} is not null`
        : `${column} is distinct from ${bind(cmp.value)}`;
    case "gt":
      return `${column} > ${bind(cmp.value)}`;
    case "gte":
      return `${column} >= ${bind(cmp.value)}`;
    case "lt":
      return `${column} < ${bind(cmp.value)}`;
    case "lte":
      return `${column} <= ${bind(cmp.value)}`;
    case "like":
      return `${column} like ${bind(cmp.value)}`;
    case "ilike":
      return `${column} ilike ${bind(cmp.value)}`;
    case "in":
      // `= any(array)` rather than `in (…)`: one bound parameter instead of
      // one per element, so a list of two thousand ids is still one statement
      // Postgres can plan and cache.
      if ((cmp.values ?? []).length === 0) return "false";
      return `${column} = any(${bind(cmp.values)}::${cmp.cast}[])`;
    case "overlaps":
      if ((cmp.values ?? []).length === 0) return "false";
      return `${column} && ${bind(cmp.values)}::${cmp.cast}`;
    case "isNull":
      return cmp.value ? `${column} is null` : `${column} is not null`;
    case "sql": {
      // Each `?` consumes the next parameter, so the caller writes SQL
      // without having to know its own position in the statement.
      let i = 0;
      return (cmp.fragment ?? "").replace(/\?/g, () => bind((cmp.params ?? [])[i++]));
    }
  }
}

function filtersSql(filters: Filters, bind: Binder): string {
  const clauses: string[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;

    if (key === "$or") {
      const branches = (value as Filters[])
        .map((branch) => filtersSql(branch, bind))
        .filter((sql) => sql !== "true");
      if (branches.length > 0) clauses.push(`(${branches.join(" or ")})`);
      continue;
    }

    if (key === "$raw") {
      for (const { sql, params = [] } of value as { sql: string; params?: unknown[] }[]) {
        let i = 0;
        clauses.push(`(${sql.replace(/\?/g, () => bind(params[i++]))})`);
      }
      continue;
    }

    checkIdentifier(key, "column name");
    clauses.push(
      isComparison(value)
        ? comparisonSql(key, value, bind)
        : comparisonSql(key, eq(value), bind)
    );
  }

  return clauses.length > 0 ? clauses.join(" and ") : "true";
}

/** The `where` clause and its parameters, for the rare hand-written query. */
export function buildWhere(filters: Filters = {}): { text: string; params: unknown[] } {
  const params: unknown[] = [];
  const text = filtersSql(filters, binder(params));
  return { text, params };
}

// ---------------------------------------------------------------- reading --

export interface SelectOptions {
  /** Raw SQL. Defaults to `*`. */
  columns?: string;
  /** Raw SQL, for an alias. Defaults to the table name. */
  from?: string;
  /** Raw SQL join clauses. */
  joins?: string;
  where?: Filters;
  /** Raw SQL. */
  groupBy?: string;
  /** Raw SQL. Never build this from user input. */
  orderBy?: string;
  limit?: number;
  offset?: number;
}

function selectSql(table: string, options: SelectOptions): { text: string; params: unknown[] } {
  checkIdentifier(table, "table name");
  const params: unknown[] = [];
  const bind = binder(params);
  const where = filtersSql(options.where ?? {}, bind);

  let text = `select ${options.columns ?? "*"} from ${options.from ?? table}`;
  if (options.joins) text += ` ${options.joins}`;
  if (where !== "true") text += ` where ${where}`;
  if (options.groupBy) text += ` group by ${options.groupBy}`;
  if (options.orderBy) text += ` order by ${options.orderBy}`;
  if (options.limit !== undefined) text += ` limit ${bind(options.limit)}`;
  if (options.offset) text += ` offset ${bind(options.offset)}`;

  return { text, params };
}

export async function selectMany<T>(table: string, options: SelectOptions = {}): Promise<T[]> {
  const { text, params } = selectSql(table, options);
  return query<T>(text, params);
}

export async function selectOne<T>(
  table: string,
  options: SelectOptions = {}
): Promise<T | null> {
  const { text, params } = selectSql(table, { ...options, limit: 1 });
  return maybeOne<T>(text, params);
}

/** The row, or an error. For when its absence is a bug rather than a case. */
export async function selectOneOrThrow<T>(
  table: string,
  options: SelectOptions = {}
): Promise<T> {
  const { text, params } = selectSql(table, { ...options, limit: 1 });
  return one<T>(text, params);
}

export async function countRows(table: string, where: Filters = {}): Promise<number> {
  const row = await selectOneOrThrow<{ count: number }>(table, {
    columns: "count(*)::int as count",
    where,
  });
  return row.count;
}

export async function exists(table: string, where: Filters): Promise<boolean> {
  return (await countRows(table, where)) > 0;
}

/** One column of every matching row, already unwrapped. */
export async function selectColumn<T>(
  table: string,
  column: string,
  options: Omit<SelectOptions, "columns"> = {}
): Promise<T[]> {
  checkIdentifier(column, "column name");
  const rows = await selectMany<Record<string, T>>(table, { ...options, columns: column });
  return rows.map((row) => row[column]);
}

// ---------------------------------------------------------------- writing --

/**
 * Keys whose value is `undefined` are dropped, which is what the Supabase
 * client did (JSON.stringify omits them) and therefore what the forms have
 * always relied on: a field left blank keeps its stored value rather than
 * clearing it. Pass `null` to clear a column on purpose.
 */
function writableColumns(values: Record<string, unknown>): string[] {
  const names = Object.keys(values).filter((key) => values[key] !== undefined);
  for (const name of names) checkIdentifier(name, "column name");
  return names;
}

export interface ConflictOptions {
  /** Column(s) the unique constraint is on. */
  onConflict: string | string[];
  /** Overwrite on conflict. Default is to leave the existing row alone. */
  update?: boolean;
  /** Extra assignments when updating, e.g. `{ updated_at: "now()" }` (raw SQL). */
  alsoSet?: Record<string, string>;
}

function conflictSql(columns: string[], conflict?: ConflictOptions): string {
  if (!conflict) return "";
  const targets = (
    Array.isArray(conflict.onConflict) ? conflict.onConflict : [conflict.onConflict]
  ).map((c) => {
    checkIdentifier(c, "column name");
    return c;
  });

  if (!conflict.update) return ` on conflict (${targets.join(", ")}) do nothing`;

  const assignments = columns
    .filter((c) => !targets.includes(c))
    .map((c) => `${c} = excluded.${c}`)
    .concat(
      Object.entries(conflict.alsoSet ?? {}).map(([c, sql]) => {
        checkIdentifier(c, "column name");
        return `${c} = ${sql}`;
      })
    );

  if (assignments.length === 0) return ` on conflict (${targets.join(", ")}) do nothing`;
  return ` on conflict (${targets.join(", ")}) do update set ${assignments.join(", ")}`;
}

export async function insertOne<T>(
  table: string,
  values: Record<string, unknown>,
  conflict?: ConflictOptions
): Promise<T> {
  checkIdentifier(table, "table name");
  const columns = writableColumns(values);
  if (columns.length === 0) throw new Error(`Nothing to insert into ${table}`);

  const params: unknown[] = [];
  const bind = binder(params);
  const placeholders = columns.map((c) => bind(values[c]));

  return one<T>(
    `insert into ${table} (${columns.join(", ")})
     values (${placeholders.join(", ")})${conflictSql(columns, conflict)}
     returning *`,
    params
  );
}

/**
 * Many rows in one statement, in chunks.
 *
 * Every row is written with the same column list, so a row that happens to
 * omit a field still writes null for it rather than inheriting a value from
 * its neighbours. Chunked because a single statement carrying thousands of
 * rows is one thing that can time out and lose everything.
 */
export async function insertMany(
  table: string,
  rows: Record<string, unknown>[],
  options: { conflict?: ConflictOptions; chunkSize?: number } = {}
): Promise<number> {
  checkIdentifier(table, "table name");
  if (rows.length === 0) return 0;

  const columns = [...new Set(rows.flatMap(writableColumns))];
  if (columns.length === 0) throw new Error(`Nothing to insert into ${table}`);
  const chunkSize = options.chunkSize ?? 250;
  let written = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const params: unknown[] = [];
    const bind = binder(params);
    const tuples = chunk.map(
      (row) => `(${columns.map((c) => bind(row[c] ?? null)).join(", ")})`
    );

    written += await execute(
      `insert into ${table} (${columns.join(", ")})
       values ${tuples.join(", ")}${conflictSql(columns, options.conflict)}`,
      params
    );
  }

  return written;
}

export async function updateMany<T>(
  table: string,
  values: Record<string, unknown>,
  where: Filters
): Promise<T[]> {
  checkIdentifier(table, "table name");
  const columns = writableColumns(values);
  if (columns.length === 0) throw new Error(`Nothing to update in ${table}`);

  const params: unknown[] = [];
  const bind = binder(params);
  const assignments = columns.map((c) => `${c} = ${bind(values[c])}`);
  const clause = filtersSql(where, bind);
  if (clause === "true") {
    // An unfiltered update rewrites the whole table. If that is genuinely
    // wanted, say so with `{ $raw: [{ sql: "true" }] }`.
    throw new Error(`Refusing to update every row of ${table}: no filters given`);
  }

  return query<T>(
    `update ${table} set ${assignments.join(", ")} where ${clause} returning *`,
    params
  );
}

/** Updates and returns the single affected row; throws if nothing matched. */
export async function updateOne<T>(
  table: string,
  values: Record<string, unknown>,
  where: Filters
): Promise<T> {
  const rows = await updateMany<T>(table, values, where);
  if (rows.length === 0) throw new Error(`No row in ${table} matched the update`);
  return rows[0];
}

/** Insert, or overwrite the row that collides on `onConflict`. */
export async function upsertOne<T>(
  table: string,
  values: Record<string, unknown>,
  onConflict: string | string[],
  alsoSet?: Record<string, string>
): Promise<T> {
  return insertOne<T>(table, values, { onConflict, update: true, alsoSet });
}

export async function deleteMany(table: string, where: Filters): Promise<number> {
  checkIdentifier(table, "table name");
  const params: unknown[] = [];
  const bind = binder(params);
  const clause = filtersSql(where, bind);
  if (clause === "true") {
    throw new Error(`Refusing to delete every row of ${table}: no filters given`);
  }
  return execute(`delete from ${table} where ${clause}`, params);
}
