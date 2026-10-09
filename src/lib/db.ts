import "server-only";
import { Pool, types } from "pg";

/**
 * PostgreSQL access for the whole application.
 *
 * The data layer used to go through Supabase's client, which speaks PostgREST
 * — an HTTP API in front of Postgres. Azure Database for PostgreSQL is the
 * database on its own, so everything here is plain SQL over a connection pool.
 *
 * Nothing in this file is reachable from the browser: `server-only` makes an
 * accidental client import a build error rather than a leaked connection
 * string.
 */

// ---------------------------------------------------------------- parsers --
//
// node-postgres hands back JS Dates for timestamps, strings for numerics and
// strings for bigints. The rest of the app was written against Supabase, which
// returns ISO strings and JSON numbers, and relies on that in a hundred small
// places — `formatDate(link.created_at)`, `a.created_at > b.created_at`,
// `profile.dob.slice(0, 4)`. These parsers keep the shapes identical so the
// change stops at this file.

types.setTypeParser(types.builtins.DATE, (value) => value); // 1995-12-09, not a Date
types.setTypeParser(types.builtins.TIMESTAMP, (value) =>
  new Date(`${value}Z`).toISOString()
);
types.setTypeParser(types.builtins.TIMESTAMPTZ, (value) =>
  new Date(value).toISOString()
);
types.setTypeParser(types.builtins.NUMERIC, (value) => Number(value));
types.setTypeParser(types.builtins.INT8, (value) => Number(value));

// ------------------------------------------------------------------- pool --

declare global {
  // eslint-disable-next-line no-var
  var __anurupaPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Missing DATABASE_URL. Expected postgresql://user:password@host:5432/anurupa?sslmode=require"
    );
  }

  return new Pool({
    connectionString,
    // Azure requires TLS and presents a DigiCert certificate, which Node
    // already trusts, so the chain is verified rather than waved through.
    // PGSSL_NO_VERIFY exists for a self-hosted server with its own CA; it
    // turns the connection into an unauthenticated one, so treat it as a
    // last resort rather than a fix.
    ssl:
      process.env.PGSSL_NO_VERIFY === "1"
        ? { rejectUnauthorized: false }
        : { rejectUnauthorized: true },
    // A Burstable B1ms server allows a few dozen connections in total, and a
    // single App Service instance should not try to own all of them.
    max: Number(process.env.PGPOOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

/**
 * One pool per process. Cached on globalThis because `next dev` re-evaluates
 * modules on every edit, and a fresh pool per edit exhausts the server's
 * connection slots within a few saves.
 */
export function getPool(): Pool {
  if (!globalThis.__anurupaPool) {
    const pool = createPool();
    // An idle client erroring (server restart, failover, idle timeout) emits
    // on the pool. Unhandled, it takes the whole Node process down.
    pool.on("error", (err) => {
      console.error("[db] idle client error:", err.message);
    });
    globalThis.__anurupaPool = pool;
  }
  return globalThis.__anurupaPool;
}

// ---------------------------------------------------------------- queries --

/** Every matching row. */
export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

/** The first row, or null. */
export async function maybeOne<T>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** The first row; throws if the statement returned none. */
export async function one<T>(text: string, params: unknown[] = []): Promise<T> {
  const row = await maybeOne<T>(text, params);
  if (!row) throw new Error(`Expected a row, got none:\n${text}`);
  return row;
}

/** For statements with nothing to return. Gives back the rows affected. */
export async function execute(text: string, params: unknown[] = []): Promise<number> {
  const result = await getPool().query(text, params);
  return result.rowCount ?? 0;
}

/** A single count(*). */
export async function count(text: string, params: unknown[] = []): Promise<number> {
  const row = await one<{ count: string | number }>(text, params);
  return Number(row.count);
}

/** Runs the callback inside a transaction, rolling back if it throws. */
export async function transaction<T>(
  fn: (run: (text: string, params?: unknown[]) => Promise<unknown[]>) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await fn(async (text, params = []) => {
      const r = await client.query(text, params);
      return r.rows;
    });
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// ----------------------------------------------------- statement builders --

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/**
 * Column names reach these builders from our own schemas, never from a
 * request body — but a typo that silently produced valid SQL would be worse
 * than a loud failure, and the check costs nothing.
 */
function columns(values: Record<string, unknown>): string[] {
  const names = Object.keys(values).filter((k) => values[k] !== undefined);
  for (const name of names) {
    if (!IDENTIFIER.test(name)) throw new Error(`Unsafe column name: ${name}`);
  }
  return names;
}

export interface Statement {
  text: string;
  params: unknown[];
}

/**
 * Builds `insert into <table> (…) values (…) returning *`.
 *
 * Keys whose value is `undefined` are left out entirely, which is what the
 * Supabase client did (JSON.stringify drops them) and therefore what the
 * forms have always relied on.
 */
export function buildInsert(table: string, values: Record<string, unknown>): Statement {
  const names = columns(values);
  if (names.length === 0) throw new Error(`Nothing to insert into ${table}`);
  const placeholders = names.map((_, i) => `$${i + 1}`);
  return {
    text: `insert into ${table} (${names.join(", ")}) values (${placeholders.join(", ")}) returning *`,
    params: names.map((n) => values[n]),
  };
}

/** Builds `update <table> set … where <whereColumn> = $n returning *`. */
export function buildUpdate(
  table: string,
  values: Record<string, unknown>,
  where: { column: string; value: unknown }
): Statement {
  const names = columns(values);
  if (names.length === 0) throw new Error(`Nothing to update in ${table}`);
  if (!IDENTIFIER.test(where.column)) throw new Error(`Unsafe column name: ${where.column}`);

  const assignments = names.map((n, i) => `${n} = $${i + 1}`);
  return {
    text: `update ${table} set ${assignments.join(", ")} where ${where.column} = $${names.length + 1} returning *`,
    params: [...names.map((n) => values[n]), where.value],
  };
}

/**
 * Builds an upsert keyed on one column — the `onConflict` option the Supabase
 * client took. Every column in the payload is overwritten on conflict.
 */
export function buildUpsert(
  table: string,
  values: Record<string, unknown>,
  conflictColumn: string
): Statement {
  const insert = buildInsert(table, values);
  const names = columns(values);
  if (!IDENTIFIER.test(conflictColumn)) {
    throw new Error(`Unsafe column name: ${conflictColumn}`);
  }
  const updates = names
    .filter((n) => n !== conflictColumn)
    .map((n) => `${n} = excluded.${n}`);

  const action = updates.length > 0 ? `do update set ${updates.join(", ")}` : "do nothing";
  return {
    text: insert.text.replace(
      " returning *",
      ` on conflict (${conflictColumn}) ${action} returning *`
    ),
    params: insert.params,
  };
}
