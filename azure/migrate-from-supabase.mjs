#!/usr/bin/env node
/**
 * One-off: copy everything out of Supabase and into Azure.
 *
 *   node azure/migrate-from-supabase.mjs            # rows and files
 *   node azure/migrate-from-supabase.mjs --rows     # rows only
 *   node azure/migrate-from-supabase.mjs --files    # files only
 *   node azure/migrate-from-supabase.mjs --dry-run  # count, write nothing
 *
 * Reads Supabase through its REST API with the service-role key, so it needs
 * no database password from the Supabase dashboard — only what is already in
 * .env.local. Writes to Azure through the same connection the app uses.
 *
 * Safe to re-run. Rows are inserted with `on conflict do nothing`, and a blob
 * already present in Azure at the same size is skipped, so an interrupted run
 * is resumed simply by running it again.
 *
 * Needs, in the environment (azure/deploy-local.sh style):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   the source
 *   DATABASE_URL                              the Azure database
 *   AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_KEY  the Azure storage account
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// ------------------------------------------------------------------- env --

/** Minimal .env reader: KEY=value, # comments, \$ unescaped as the app does. */
function loadEnv(file) {
  let text;
  try {
    text = readFileSync(join(repoRoot, file), "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key]) continue;
    let value = raw.trim().replace(/\s+#.*$/, "");
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
    process.env[key] = value.replace(/\\\$/g, "$");
  }
}

loadEnv(".env.local");
loadEnv("azure/.env.azure");

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "AZURE_STORAGE_ACCOUNT",
  "AZURE_STORAGE_KEY",
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(2);
}

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const DO_ROWS = !args.has("--files");
const DO_FILES = !args.has("--rows");

const SUPABASE = process.env.SUPABASE_URL.replace(/\/+$/, "");
const HEADERS = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
};

// ---------------------------------------------------------------- tables --
//
// Parents before children: every foreign key must already point at something
// by the time the referencing row is inserted.

const TABLES = [
  { name: "profiles", conflict: "id", order: "id" },
  { name: "clients", conflict: "id", order: "id" },
  // setup.sql seeds app_settings with a default row, so this one has to
  // overwrite rather than skip — otherwise the saved colour palette and
  // expiry default would be silently left behind.
  { name: "app_settings", conflict: "id", order: "id", overwrite: true },
  // Like app_settings, setup.sql seeds a row per consultant, so these have
  // to overwrite — otherwise the notes they have actually written are
  // silently replaced by the empty placeholders.
  { name: "team_notes", conflict: "slug", order: "slug", overwrite: true },
  { name: "share_links", conflict: "id", order: "id" },
  {
    name: "share_link_profiles",
    conflict: "share_link_id, profile_id",
    order: "share_link_id,profile_id",
  },
  { name: "profile_photos", conflict: "id", order: "id" },
  { name: "client_shortlists", conflict: "id", order: "id" },
  { name: "client_searches", conflict: "id", order: "id" },
  { name: "client_followups", conflict: "id", order: "id" },
  { name: "journey_media", conflict: "id", order: "id" },
];

const PAGE = 1000; // PostgREST will not return more than this in one response

/**
 * Every row of a table, a page at a time.
 *
 * The explicit `order` is not cosmetic: paging with limit/offset over an
 * unordered result is free to return a row twice and skip another, which on a
 * 2,700-row table would be a silent, partial copy.
 */
async function fetchAll(table, order) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = `${SUPABASE}/rest/v1/${table}?select=*&order=${order}&limit=${PAGE}&offset=${offset}`;
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) {
      const body = await response.text();
      // A table that never existed in Supabase (added later, on Azure only)
      // is not an error — there is simply nothing to copy.
      if (response.status === 404) return rows;
      throw new Error(`${table}: HTTP ${response.status} ${body.slice(0, 200)}`);
    }
    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

/** jsonb columns arrive as objects; pg needs them as text. Arrays map natively. */
function encode(value) {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value;
}

/** The columns a table actually has in Azure, so we only write those. */
async function targetColumns(pool, table) {
  const { rows } = await pool.query(
    `select column_name from information_schema.columns
      where table_schema = 'public' and table_name = $1`,
    [table]
  );
  return new Set(rows.map((r) => r.column_name));
}

async function copyRows(pool) {
  let grandTotal = 0;

  for (const { name, conflict, order, overwrite } of TABLES) {
    const rows = await fetchAll(name, order);
    if (rows.length === 0) {
      console.log(`  ${name.padEnd(22)} nothing to copy`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  ${name.padEnd(22)} ${String(rows.length).padStart(5)} rows (dry run)`);
      grandTotal += rows.length;
      continue;
    }

    // Only the columns the Azure table actually has. Supabase still carries
    // retired columns that setup.sql no longer creates, and copying a column
    // into a table that lacks it fails the whole statement.
    const available = await targetColumns(pool, name);
    const sourceColumns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const columns = sourceColumns.filter((c) => available.has(c));
    const dropped = sourceColumns.filter((c) => !available.has(c));
    let written = 0;

    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const params = [];
      const tuples = chunk.map((row) => {
        const placeholders = columns.map((column) => {
          params.push(encode(row[column] ?? null));
          return `$${params.length}`;
        });
        return `(${placeholders.join(", ")})`;
      });

      const action = overwrite
        ? `do update set ${columns
            .filter((c) => !conflict.split(",").map((x) => x.trim()).includes(c))
            .map((c) => `${c} = excluded.${c}`)
            .join(", ")}`
        : "do nothing";

      const result = await pool.query(
        `insert into ${name} (${columns.join(", ")})
         values ${tuples.join(", ")}
         on conflict (${conflict}) ${action}`,
        params
      );
      written += result.rowCount ?? 0;
    }

    const skipped = rows.length - written;
    console.log(
      `  ${name.padEnd(22)} ${String(written).padStart(5)} written` +
        (skipped > 0 ? `, ${skipped} already there` : "") +
        (dropped.length > 0 ? `, ignoring retired ${dropped.join(", ")}` : "")
    );
    grandTotal += written;
  }

  return grandTotal;
}

// ----------------------------------------------------------------- files --
//
// The paths come from the database rather than from a bucket listing, so what
// gets copied is exactly what the application can still reach. An orphaned
// blob in Supabase that no row points at is left behind on purpose.

async function copyFiles() {
  // Read from Supabase, not from Azure: this has to give the same answer
  // whether or not the rows have been copied yet, so that --dry-run and
  // --files both report the truth.
  const sets = [
    {
      container: "profile-photos",
      bucket: "profile-photos",
      paths: (await fetchAll("profile_photos", "id")).map((r) => r.storage_path),
    },
    {
      container: "journey-media",
      bucket: "journey-media",
      paths: (await fetchAll("journey_media", "id")).map((r) => r.storage_path),
    },
  ];

  const credential = new StorageSharedKeyCredential(
    process.env.AZURE_STORAGE_ACCOUNT,
    process.env.AZURE_STORAGE_KEY
  );
  const service = new BlobServiceClient(
    `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`,
    credential
  );

  let copied = 0;
  let skipped = 0;
  const failed = [];

  for (const { container, bucket, paths } of sets) {
    if (paths.length === 0) {
      console.log(`  ${container.padEnd(22)} nothing to copy`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`  ${container.padEnd(22)} ${String(paths.length).padStart(5)} files (dry run)`);
      continue;
    }

    const client = service.getContainerClient(container);
    let done = 0;

    // Eight at a time: enough to keep the link busy, few enough that a slow
    // response cannot pile up thousands of open sockets.
    for (let i = 0; i < paths.length; i += 8) {
      await Promise.all(
        paths.slice(i, i + 8).map(async (path) => {
          const blob = client.getBlockBlobClient(path);

          try {
            const source = await fetch(
              `${SUPABASE}/storage/v1/object/${bucket}/${encodeURI(path)}`,
              { headers: HEADERS }
            );
            if (!source.ok) {
              failed.push(`${bucket}/${path}: HTTP ${source.status}`);
              return;
            }
            const body = Buffer.from(await source.arrayBuffer());

            // Already there and the same size: this is a resumed run.
            const existing = await blob.exists();
            if (existing) {
              const properties = await blob.getProperties();
              if (properties.contentLength === body.length) {
                skipped += 1;
                return;
              }
            }

            await blob.uploadData(body, {
              blobHTTPHeaders: {
                blobContentType:
                  source.headers.get("content-type") ?? "application/octet-stream",
                blobCacheControl: "private, max-age=3600",
              },
            });
            copied += 1;
          } catch (error) {
            failed.push(`${bucket}/${path}: ${error.message}`);
          }
        })
      );

      done = Math.min(i + 8, paths.length);
      process.stdout.write(`\r  ${container.padEnd(22)} ${done}/${paths.length}`);
    }
    process.stdout.write("\n");
  }

  return { copied, skipped, failed };
}

// ------------------------------------------------------------------ main --

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.PGSSL_NO_VERIFY === "1"
      ? { rejectUnauthorized: false }
      : { rejectUnauthorized: true },
  max: 4,
});

try {
  console.log(`\nSupabase  ${SUPABASE}`);
  console.log(`Azure     ${process.env.DATABASE_URL.replace(/:[^:@]*@/, ":****@")}`);
  console.log(`Storage   ${process.env.AZURE_STORAGE_ACCOUNT}`);
  if (DRY_RUN) console.log("\nDRY RUN — nothing will be written.");

  if (DO_ROWS) {
    console.log("\nRows");
    const total = await copyRows(pool);
    console.log(`  ${"".padEnd(22)} ${String(total).padStart(5)} rows in total`);
  }

  if (DO_FILES) {
    console.log("\nFiles");
    const { copied, skipped, failed } = await copyFiles();
    if (!DRY_RUN) {
      console.log(`  copied ${copied}, already there ${skipped}, failed ${failed.length}`);
      for (const line of failed.slice(0, 20)) console.log(`    ${line}`);
      if (failed.length > 20) console.log(`    …and ${failed.length - 20} more`);
    }
    if (failed.length > 0) process.exitCode = 1;
  }

  console.log("");
} finally {
  await pool.end();
}
