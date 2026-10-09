import "server-only";
import { count, execute, one, query, transaction } from "@/lib/db";
import { deleteBlobs, signedUrl, uploadBlob } from "@/lib/storage/blob";
import { PROFILE_PHOTOS_CONTAINER, SIGNED_URL_TTL_SECONDS } from "@/lib/constants";
import type { ProfilePhoto } from "@/lib/types";

export async function uploadProfilePhoto(
  profileId: string,
  file: File
): Promise<ProfilePhoto> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${profileId}/${crypto.randomUUID()}.${ext}`;

  await uploadBlob(PROFILE_PHOTOS_CONTAINER, path, file);

  const existing = await count(
    "select count(*) from profile_photos where profile_id = $1",
    [profileId]
  );

  return one<ProfilePhoto>(
    `insert into profile_photos (profile_id, storage_path, sort_order, is_cover)
     values ($1, $2, $3, $4)
     returning *`,
    [profileId, path, existing, existing === 0]
  );
}

export async function deleteProfilePhoto(photoId: string): Promise<void> {
  const photo = await one<{ storage_path: string }>(
    "select storage_path from profile_photos where id = $1",
    [photoId]
  );

  await deleteBlobs(PROFILE_PHOTOS_CONTAINER, [photo.storage_path]);
  await execute("delete from profile_photos where id = $1", [photoId]);
}

export async function reorderProfilePhotos(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  // One statement rather than a write per photo: a half-applied reorder would
  // leave two photos claiming the same position.
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

/** Signed cover-photo URL per profile, for lightweight grid/list views. */
export async function getCoverPhotoUrls(profileIds: string[]): Promise<Map<string, string>> {
  if (profileIds.length === 0) return new Map();

  const covers = await query<{ profile_id: string; storage_path: string }>(
    `select profile_id, storage_path
       from profile_photos
      where profile_id = any($1::uuid[]) and is_cover = true`,
    [profileIds]
  );

  return new Map(
    covers.map((c) => [
      c.profile_id,
      signedUrl(PROFILE_PHOTOS_CONTAINER, c.storage_path, SIGNED_URL_TTL_SECONDS),
    ])
  );
}
