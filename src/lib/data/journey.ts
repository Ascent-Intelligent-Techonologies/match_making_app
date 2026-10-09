import "server-only";
import { execute, one, query } from "@/lib/db";
import { deleteBlobs, signedUrl, uploadBlob } from "@/lib/storage/blob";
import { JOURNEY_MEDIA_CONTAINER, SIGNED_URL_TTL_SECONDS } from "@/lib/constants";
import type { JourneyMedia } from "@/lib/types";

/** Photos and videos, newest first, each with a short-lived signed URL. */
export async function listJourneyMedia(): Promise<JourneyMedia[]> {
  const items = await query<JourneyMedia>(
    "select * from journey_media order by created_at desc"
  );

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

  await execute(
    `insert into journey_media (storage_path, file_name, content_type, size_bytes, caption)
     values ($1, $2, $3, $4, $5)`,
    [path, file.name, file.type || null, file.size, caption?.trim() || null]
  );
}

export async function deleteJourneyMedia(id: string): Promise<void> {
  const item = await one<{ storage_path: string }>(
    "select storage_path from journey_media where id = $1",
    [id]
  );

  await deleteBlobs(JOURNEY_MEDIA_CONTAINER, [item.storage_path]);
  await execute("delete from journey_media where id = $1", [id]);
}
