import "server-only";
import {
  BlobSASPermissions,
  BlobServiceClient,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";
import { JOURNEY_MEDIA_CONTAINER, PROFILE_PHOTOS_CONTAINER } from "@/lib/constants";

/**
 * Azure Blob Storage, replacing Supabase Storage.
 *
 * Both containers are private: nothing in them is reachable without a SAS
 * token minted per render, exactly the posture the Supabase buckets had.
 *
 * One difference worth knowing: Supabase signed a batch of URLs with an HTTP
 * round-trip per page render. A SAS token is an HMAC computed from the account
 * key, so signing happens locally with no network call at all — which is why
 * `signedUrl` below is synchronous.
 *
 * Uploads do not pass through this server at all. The browser asks for a
 * write-only SAS to a path the server chose (`uploadSasUrl`), PUTs the bytes
 * straight to Blob, and the server then reads them back from inside the
 * datacenter to validate and derive from. That is what keeps a 50-photo batch
 * from ever touching the App Service's request body or memory.
 */

export type ContainerName = typeof PROFILE_PHOTOS_CONTAINER | typeof JOURNEY_MEDIA_CONTAINER;

interface StorageConfig {
  account: string;
  credential: StorageSharedKeyCredential;
  service: BlobServiceClient;
}

let cached: StorageConfig | null = null;

function config(): StorageConfig {
  if (cached) return cached;

  const account = process.env.AZURE_STORAGE_ACCOUNT;
  const key = process.env.AZURE_STORAGE_KEY;
  if (!account || !key) {
    throw new Error(
      "Missing AZURE_STORAGE_ACCOUNT or AZURE_STORAGE_KEY environment variables."
    );
  }

  const credential = new StorageSharedKeyCredential(account, key);
  cached = {
    account,
    credential,
    service: new BlobServiceClient(
      `https://${account}.blob.core.windows.net`,
      credential
    ),
  };
  return cached;
}

/** The public host blobs are served from, for next.config.ts and tests. */
export function blobHost(): string {
  return `${config().account}.blob.core.windows.net`;
}

function blobUrl(container: ContainerName, path: string): string {
  return `https://${config().account}.blob.core.windows.net/${container}/${encodeURI(path)}`;
}

// ---------------------------------------------------------------- writing --

const IMMUTABLE_CACHE = "private, max-age=3600";

export async function uploadBlob(
  container: ContainerName,
  path: string,
  file: File
): Promise<void> {
  await uploadBuffer(container, path, Buffer.from(await file.arrayBuffer()), file.type);
}

/** Writes bytes the server already holds — derivatives, mostly. */
export async function uploadBuffer(
  container: ContainerName,
  path: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await config()
    .service.getContainerClient(container)
    .getBlockBlobClient(path)
    .uploadData(body, {
      blobHTTPHeaders: {
        blobContentType: contentType || "application/octet-stream",
        // Blobs are immutable once written — a new photo gets a new UUID path
        // — so they can be cached hard. The SAS expiry still bounds access.
        blobCacheControl: IMMUTABLE_CACHE,
      },
    });
}

/**
 * Removes blobs, tolerating ones that are already gone.
 *
 * A missing blob should never stop a profile from being deleted: the row is
 * the record, and an orphaned blob costs a fraction of a paisa.
 */
export async function deleteBlobs(
  container: ContainerName,
  paths: string[]
): Promise<void> {
  if (paths.length === 0) return;
  const client = config().service.getContainerClient(container);
  await Promise.all(
    paths.map((path) =>
      client
        .getBlockBlobClient(path)
        .deleteIfExists({ deleteSnapshots: "include" })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[blob] could not delete ${container}/${path}: ${message}`);
        })
    )
  );
}

// ---------------------------------------------------------------- reading --

/** The whole blob, for deriving from. Only ever called on a single upload. */
export async function downloadBlob(container: ContainerName, path: string): Promise<Buffer> {
  return config()
    .service.getContainerClient(container)
    .getBlockBlobClient(path)
    .downloadToBuffer();
}

export interface BlobInfo {
  size: number;
  contentType: string | undefined;
}

/** Size and type of a blob, or null if there is nothing at that path. */
export async function getBlobInfo(
  container: ContainerName,
  path: string
): Promise<BlobInfo | null> {
  const client = config().service.getContainerClient(container).getBlockBlobClient(path);
  if (!(await client.exists())) return null;
  const props = await client.getProperties();
  return { size: props.contentLength ?? 0, contentType: props.contentType };
}

// ---------------------------------------------------------------- signing --

/**
 * A read-only URL for one blob, valid for `ttlSeconds`.
 *
 * Starts five minutes in the past so a small clock difference between this
 * server and Azure's cannot produce a token that is not valid yet.
 */
export function signedUrl(
  container: ContainerName,
  path: string,
  ttlSeconds: number
): string {
  const { credential } = config();
  const now = Date.now();

  const sas = generateBlobSASQueryParameters(
    {
      containerName: container,
      blobName: path,
      permissions: BlobSASPermissions.parse("r"),
      startsOn: new Date(now - 5 * 60_000),
      expiresOn: new Date(now + ttlSeconds * 1000),
      protocol: SASProtocol.Https,
    },
    credential
  ).toString();

  return `${blobUrl(container, path)}?${sas}`;
}

/** The batch form, mirroring the order of the paths given. */
export function signedUrls(
  container: ContainerName,
  paths: string[],
  ttlSeconds: number
): string[] {
  return paths.map((path) => signedUrl(container, path, ttlSeconds));
}

/** How long a browser has to finish one upload before its token lapses. */
export const UPLOAD_SAS_TTL_SECONDS = 10 * 60;

/**
 * A URL the browser can PUT one blob to, and nothing else.
 *
 * Create and write only — no read, no delete, no list — scoped to exactly the
 * path the server chose, and dead ten minutes later. The worst a leaked one
 * can do is overwrite the single blob it names, which the finalise step then
 * refuses unless the bytes are a real image.
 */
export function uploadSasUrl(container: ContainerName, path: string): string {
  const { credential } = config();
  const now = Date.now();

  const sas = generateBlobSASQueryParameters(
    {
      containerName: container,
      blobName: path,
      permissions: BlobSASPermissions.parse("cw"),
      startsOn: new Date(now - 5 * 60_000),
      expiresOn: new Date(now + UPLOAD_SAS_TTL_SECONDS * 1000),
      protocol: SASProtocol.Https,
    },
    credential
  ).toString();

  return `${blobUrl(container, path)}?${sas}`;
}

// ------------------------------------------------------------ derivatives --

export interface DerivativePaths {
  thumb: string;
  medium: string;
}

/**
 * Where a photo's resized copies live, derived from the original's path so
 * nothing has to be stored: `p/abc.jpg` → `p/abc.thumb.webp`, `p/abc.medium.webp`.
 */
export function derivativePaths(storagePath: string): DerivativePaths {
  const stem = storagePath.replace(/\.[^./]+$/, "");
  return { thumb: `${stem}.thumb.webp`, medium: `${stem}.medium.webp` };
}
