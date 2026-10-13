#!/usr/bin/env node
/**
 * One-off: make thumb and medium derivatives for photos uploaded before the
 * app produced them at upload time.
 *
 *   node azure/backfill-thumbnails.mjs            # only photos missing one
 *   node azure/backfill-thumbnails.mjs --force    # regenerate every photo
 *   node azure/backfill-thumbnails.mjs --dry-run  # count, write nothing
 *
 * Run it BEFORE deploying code that serves derivatives, so no page ever asks
 * for a thumbnail that does not exist yet. It is safe to re-run; a photo that
 * already has both copies is skipped unless --force is given.
 *
 * The sizes and qualities here are the same as src/lib/images.ts. Change
 * them in both places or not at all.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import sharp from "sharp";
import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";

const SPECS = {
  thumb: { width: 480, quality: 78 },
  medium: { width: 1200, quality: 82 },
};
const CONTAINER = "profile-photos";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(file) {
  let text;
  try {
    text = readFileSync(join(repoRoot, file), "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m || process.env[m[1]]) continue;
    let v = m[2].trim().replace(/\s+#.*$/, "");
    if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1);
    process.env[m[1]] = v.replace(/\\\$/g, "$");
  }
}
loadEnv(".env.local");
loadEnv("azure/.env.azure");

for (const k of ["DATABASE_URL", "AZURE_STORAGE_ACCOUNT", "AZURE_STORAGE_KEY"]) {
  if (!process.env[k]) {
    console.error(`Missing ${k}`);
    process.exit(2);
  }
}

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const DRY_RUN = args.has("--dry-run");

const service = new BlobServiceClient(
  `https://${process.env.AZURE_STORAGE_ACCOUNT}.blob.core.windows.net`,
  new StorageSharedKeyCredential(process.env.AZURE_STORAGE_ACCOUNT, process.env.AZURE_STORAGE_KEY)
);
const container = service.getContainerClient(CONTAINER);

const derivativePaths = (p) => {
  const stem = p.replace(/\.[^./]+$/, "");
  return { thumb: `${stem}.thumb.webp`, medium: `${stem}.medium.webp` };
};

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: process.env.PGSSL_NO_VERIFY !== "1" },
  max: 2,
});

try {
  const { rows } = await pool.query(
    "select id, storage_path from profile_photos order by created_at"
  );
  console.log(`\n${rows.length} photos on record${DRY_RUN ? " (dry run)" : ""}\n`);

  let made = 0;
  let skipped = 0;
  const failed = [];

  // Four at a time: sharp is CPU-bound and this is a laptop, not the server.
  for (let i = 0; i < rows.length; i += 4) {
    await Promise.all(
      rows.slice(i, i + 4).map(async ({ storage_path }) => {
        const out = derivativePaths(storage_path);
        try {
          if (!FORCE) {
            const [t, m] = await Promise.all([
              container.getBlockBlobClient(out.thumb).exists(),
              container.getBlockBlobClient(out.medium).exists(),
            ]);
            if (t && m) {
              skipped += 1;
              return;
            }
          }
          if (DRY_RUN) {
            made += 1;
            return;
          }

          const original = await container.getBlockBlobClient(storage_path).downloadToBuffer();
          const base = sharp(original, { failOn: "error" }).rotate();
          const [thumb, medium] = await Promise.all([
            base.clone().resize({ width: SPECS.thumb.width, withoutEnlargement: true })
              .webp({ quality: SPECS.thumb.quality }).toBuffer(),
            base.clone().resize({ width: SPECS.medium.width, withoutEnlargement: true })
              .webp({ quality: SPECS.medium.quality }).toBuffer(),
          ]);

          const headers = { blobContentType: "image/webp", blobCacheControl: "private, max-age=3600" };
          await Promise.all([
            container.getBlockBlobClient(out.thumb).uploadData(thumb, { blobHTTPHeaders: headers }),
            container.getBlockBlobClient(out.medium).uploadData(medium, { blobHTTPHeaders: headers }),
          ]);
          made += 1;
          console.log(
            `  ${storage_path}  →  thumb ${(thumb.length / 1024).toFixed(0)} KB, medium ${(medium.length / 1024).toFixed(0)} KB  (from ${(original.length / 1024).toFixed(0)} KB)`
          );
        } catch (error) {
          failed.push(`${storage_path}: ${error.message}`);
        }
      })
    );
  }

  console.log(`\n${DRY_RUN ? "would make" : "made"} ${made}, skipped ${skipped}, failed ${failed.length}`);
  for (const line of failed) console.log(`  ${line}`);
  if (failed.length > 0) process.exitCode = 1;
  console.log("");
} finally {
  await pool.end();
}
