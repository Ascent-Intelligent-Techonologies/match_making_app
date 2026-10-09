import "server-only";
import {
  anyOf,
  countRows,
  deleteMany,
  execute,
  insertOne,
  selectMany,
  selectOneOrThrow,
  transaction,
} from "@/lib/db";
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

  const existing = await countRows("profile_photos", { profile_id: profileId });

  return insertOne<ProfilePhoto>("profile_photos", {
    profile_id: profileId,
    storage_path: path,
    sort_order: existing,
    is_cover: existing === 0,
  });
}

export async function deleteProfilePhoto(photoId: string): Promise<void> {
  const photo = await selectOneOrThrow<{ storage_path: string }>("profile_photos", {
    columns: "storage_path",
    where: { id: photoId },
  });

  await deleteBlobs(PROFILE_PHOTOS_CONTAINER, [photo.storage_path]);
  await deleteMany("profile_photos", { id: photoId });
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

/** Signed cover-photo URL per profile, for lightweight grid/list views. */
export async function getCoverPhotoUrls(profileIds: string[]): Promise<Map<string, string>> {
  if (profileIds.length === 0) return new Map();

  const covers = await selectMany<{ profile_id: string; storage_path: string }>(
    "profile_photos",
    {
      columns: "profile_id, storage_path",
      where: { profile_id: anyOf(profileIds, "uuid"), is_cover: true },
    }
  );

  return new Map(
    covers.map((c) => [
      c.profile_id,
      signedUrl(PROFILE_PHOTOS_CONTAINER, c.storage_path, SIGNED_URL_TTL_SECONDS),
    ])
  );
}
