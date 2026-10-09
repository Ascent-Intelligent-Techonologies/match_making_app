import "server-only";
import { deleteMany, insertOne, selectMany, selectOneOrThrow } from "@/lib/db";
import { deleteBlobs, signedUrl, uploadBlob } from "@/lib/storage/blob";
import { JOURNEY_MEDIA_CONTAINER, SIGNED_URL_TTL_SECONDS } from "@/lib/constants";
import type { JourneyMedia } from "@/lib/types";

/** Photos and videos, newest first, each with a short-lived signed URL. */
export async function listJourneyMedia(): Promise<JourneyMedia[]> {
  const items = await selectMany<JourneyMedia>("journey_media", {
    orderBy: "created_at desc",
  });

  // The container is private, exactly like profile photos, so nothing is
  // reachable without a signed URL minted on this render.
  return items.map((m) => ({
    ...m,
    signedUrl: signedUrl(JOURNEY_MEDIA_CONTAINER, m.storage_path, SIGNED_URL_TTL_SECONDS),
  }));
}

export async function uploadJourneyMedia(file: File, caption?: string): Promise<void> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${crypto.randomUUID()}.${ext}`;

  await uploadBlob(JOURNEY_MEDIA_CONTAINER, path, file);

  await insertOne("journey_media", {
    storage_path: path,
    file_name: file.name,
    content_type: file.type || null,
    size_bytes: file.size,
    caption: caption?.trim() || null,
  });
}

export async function deleteJourneyMedia(id: string): Promise<void> {
  const item = await selectOneOrThrow<{ storage_path: string }>("journey_media", {
    columns: "storage_path",
    where: { id },
  });

  await deleteBlobs(JOURNEY_MEDIA_CONTAINER, [item.storage_path]);
  await deleteMany("journey_media", { id });
}
