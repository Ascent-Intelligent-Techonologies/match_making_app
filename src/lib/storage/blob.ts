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

export async function uploadBlob(
  container: ContainerName,
  path: string,
  file: File
): Promise<void> {
  const body = Buffer.from(await file.arrayBuffer());
  await config()
    .service.getContainerClient(container)
    .getBlockBlobClient(path)
    .uploadData(body, {
      blobHTTPHeaders: {
        blobContentType: file.type || "application/octet-stream",
        // Blobs are immutable once written — a new photo gets a new UUID path
        // — so they can be cached hard. The SAS expiry still bounds access.
        blobCacheControl: "private, max-age=3600",
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
  const { account, credential } = config();
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

  return `https://${account}.blob.core.windows.net/${container}/${encodeURI(path)}?${sas}`;
}

/** The batch form, mirroring the order of the paths given. */
export function signedUrls(
  container: ContainerName,
  paths: string[],
  ttlSeconds: number
): string[] {
  return paths.map((path) => signedUrl(container, path, ttlSeconds));
}
