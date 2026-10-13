import "server-only";
import {
  anyOf,
  countRows,
  deleteMany,
  execute,
  insertOne,
  selectMany,
  selectOne,
  selectOneOrThrow,
  transaction,
} from "@/lib/db";
import {
  deleteBlobs,
  derivativePaths,
  downloadBlob,
  getBlobInfo,
  signedUrl,
  uploadBuffer,
  uploadSasUrl,
  UPLOAD_SAS_TTL_SECONDS,
} from "@/lib/storage/blob";
import { DERIVATIVE_CONTENT_TYPE, makeDerivatives } from "@/lib/images";
import {
  MAX_PHOTO_BYTES,
  PROFILE_PHOTOS_CONTAINER,
  SIGNED_URL_TTL_SECONDS,
} from "@/lib/constants";
import type { ProfilePhoto } from "@/lib/types";

// ------------------------------------------------------------------ urls --

export interface PhotoUrls {
  /** The original. Kept, never shown on a page. */
  signedUrl: string;
  /** 480 px WebP — grids and cover tiles. */
  thumbUrl: string;
  /** 1200 px WebP — carousel, slideshow, share page. */
  mediumUrl: string;
}

export function photoUrls(storagePath: string): PhotoUrls {
  const d = derivativePaths(storagePath);
  return {
    signedUrl: signedUrl(PROFILE_PHOTOS_CONTAINER, storagePath, SIGNED_URL_TTL_SECONDS),
    thumbUrl: signedUrl(PROFILE_PHOTOS_CONTAINER, d.thumb, SIGNED_URL_TTL_SECONDS),
    mediumUrl: signedUrl(PROFILE_PHOTOS_CONTAINER, d.medium, SIGNED_URL_TTL_SECONDS),
  };
}

/** A row with its three URLs attached, for a page to render from. */
export function withPhotoUrls<T extends { storage_path: string }>(photo: T): T & PhotoUrls {
  return { ...photo, ...photoUrls(photo.storage_path) };
}

/** Every blob a photo owns: the original and both derivatives. */
function blobPathsFor(storagePath: string): string[] {
  const d = derivativePaths(storagePath);
  return [storagePath, d.thumb, d.medium];
}

// ---------------------------------------------------------------- upload --
//
// Two halves. The browser never sends the bytes to this server: it asks for
// a write-only SAS to a path chosen here, PUTs straight to Blob Storage, and
// then asks for the upload to be finalised. Finalising is where the bytes
// are read back (from inside the datacenter), checked to be an image, and
// resized into the two copies every page actually shows.

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "image/gif": "gif",
};

/** The shape of a path this server would have handed out. */
const UPLOAD_PATH = /^([0-9a-f-]{36})\/[0-9a-f-]{36}\.[a-z0-9]{1,5}$/;

export interface UploadTicket {
  path: string;
  uploadUrl: string;
  expiresInSeconds: number;
}

export async function beginPhotoUpload(
  profileId: string,
  file: { name: string; type: string; size: number }
): Promise<UploadTicket> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} is not an image.`);
  }
  if (file.size <= 0) throw new Error(`${file.name} is empty.`);
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error(
      `${file.name} is ${(file.size / 1_048_576).toFixed(0)} MB; the limit is ${MAX_PHOTO_BYTES / 1_048_576} MB.`
    );
  }

  // The profile has to exist and not be in the bin. Without this a stale
  // editor tab could keep filling storage for a profile nobody can see.
  const profile = await selectOne<{ id: string }>("profiles", {
    columns: "id",
    where: { id: profileId, deleted_at: null },
  });
  if (!profile) throw new Error("That profile no longer exists.");

  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  const ext = /^[a-z0-9]{1,5}$/.test(fromName)
    ? fromName
    : (EXTENSION_BY_TYPE[file.type] ?? "jpg");
  const path = `${profileId}/${crypto.randomUUID()}.${ext}`;

  return {
    path,
    uploadUrl: uploadSasUrl(PROFILE_PHOTOS_CONTAINER, path),
    expiresInSeconds: UPLOAD_SAS_TTL_SECONDS,
  };
}

export async function finalisePhotoUpload(
  profileId: string,
  path: string
): Promise<ProfilePhoto & PhotoUrls> {
  // Only a path this server would have issued, for this profile. Anything
  // else is a client trying to register a blob it should not be able to.
  const match = UPLOAD_PATH.exec(path);
  if (!match || match[1] !== profileId) throw new Error("Unrecognised upload.");

  const info = await getBlobInfo(PROFILE_PHOTOS_CONTAINER, path);
  if (!info || info.size === 0) throw new Error("The upload did not arrive.");
  if (info.size > MAX_PHOTO_BYTES) {
    await deleteBlobs(PROFILE_PHOTOS_CONTAINER, [path]);
    throw new Error(`That file is over the ${MAX_PHOTO_BYTES / 1_048_576} MB limit.`);
  }

  // Already registered — a retried finalise after a slow network, say.
  const existing = await selectOne<ProfilePhoto>("profile_photos", {
    where: { storage_path: path },
  });
  if (existing) return withPhotoUrls(existing);

  const d = derivativePaths(path);
  try {
    const original = await downloadBlob(PROFILE_PHOTOS_CONTAINER, path);
    const made = await makeDerivatives(original);
    await Promise.all([
      uploadBuffer(PROFILE_PHOTOS_CONTAINER, d.thumb, made.thumb, DERIVATIVE_CONTENT_TYPE),
      uploadBuffer(PROFILE_PHOTOS_CONTAINER, d.medium, made.medium, DERIVATIVE_CONTENT_TYPE),
    ]);
  } catch (error) {
    // Nothing is registered, so nothing should be left behind either.
    await deleteBlobs(PROFILE_PHOTOS_CONTAINER, blobPathsFor(path));
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(/not an image/i.test(message) ? message : "That file could not be read as an image.");
  }

  const existingCount = await countRows("profile_photos", { profile_id: profileId });
  const row = await insertOne<ProfilePhoto>("profile_photos", {
    profile_id: profileId,
    storage_path: path,
    sort_order: existingCount,
    is_cover: existingCount === 0,
  });
  return withPhotoUrls(row);
}

/**
 * The server-side path, for the new-profile form, which has no profile id
 * until the row exists and so cannot use the direct upload. Same pipeline
 * from the bytes onwards; only the first hop differs.
 */
export async function storeProfilePhoto(
  profileId: string,
  file: File
): Promise<ProfilePhoto> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error(`${file.name} is over the ${MAX_PHOTO_BYTES / 1_048_576} MB limit.`);
  }

  const original = Buffer.from(await file.arrayBuffer());
  const made = await makeDerivatives(original);

  const fromName = file.name.split(".").pop()?.toLowerCase() ?? "";
  const ext = /^[a-z0-9]{1,5}$/.test(fromName)
    ? fromName
    : (EXTENSION_BY_TYPE[file.type] ?? "jpg");
  const path = `${profileId}/${crypto.randomUUID()}.${ext}`;
  const d = derivativePaths(path);

  await Promise.all([
    uploadBuffer(PROFILE_PHOTOS_CONTAINER, path, original, file.type),
    uploadBuffer(PROFILE_PHOTOS_CONTAINER, d.thumb, made.thumb, DERIVATIVE_CONTENT_TYPE),
    uploadBuffer(PROFILE_PHOTOS_CONTAINER, d.medium, made.medium, DERIVATIVE_CONTENT_TYPE),
  ]);

  const existingCount = await countRows("profile_photos", { profile_id: profileId });
  return insertOne<ProfilePhoto>("profile_photos", {
    profile_id: profileId,
    storage_path: path,
    sort_order: existingCount,
    is_cover: existingCount === 0,
  });
}

// ------------------------------------------------------------ management --

export async function deleteProfilePhoto(photoId: string): Promise<void> {
  const photo = await selectOneOrThrow<{ storage_path: string }>("profile_photos", {
    columns: "storage_path",
    where: { id: photoId },
  });

  await deleteBlobs(PROFILE_PHOTOS_CONTAINER, blobPathsFor(photo.storage_path));
  await deleteMany("profile_photos", { id: photoId });
}

/** For removing a whole profile: every blob of every photo it has. */
export function photoBlobPaths(storagePaths: string[]): string[] {
  return storagePaths.flatMap(blobPathsFor);
}

export async function reorderProfilePhotos(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  // `update … from unnest(…) with ordinality` is beyond a generic builder,
  // and worth it: one statement rather than a write per photo, so a failure
  // cannot leave two photos claiming the same position.
  await execute(
    `update profile_photos p
        set sort_order = v.position
       from unnest($1::uuid[]) with ordinality as v(id, position)
      where p.id = v.id`,
    [orderedIds]
  );
}

export async function setCoverPhoto(profileId: string, photoId: string): Promise<void> {
  // Both halves together, so a failure can never leave a profile with two
  // covers or none.
  await transaction(async (run) => {
    await run("update profile_photos set is_cover = false where profile_id = $1", [profileId]);
    await run("update profile_photos set is_cover = true where id = $1", [photoId]);
  });
}

export interface CoverUrls {
  thumb: string;
  medium: string;
}

/** Signed cover URLs per profile: thumb for the grid, medium for the slideshow. */
export async function getCoverPhotoUrls(profileIds: string[]): Promise<Map<string, CoverUrls>> {
  if (profileIds.length === 0) return new Map();

  const covers = await selectMany<{ profile_id: string; storage_path: string }>(
    "profile_photos",
    {
      columns: "profile_id, storage_path",
      where: { profile_id: anyOf(profileIds, "uuid"), is_cover: true },
    }
  );

  return new Map(
    covers.map((c) => {
      const urls = photoUrls(c.storage_path);
      return [c.profile_id, { thumb: urls.thumbUrl, medium: urls.mediumUrl }];
    })
  );
}
