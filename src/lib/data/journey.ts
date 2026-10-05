import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { JOURNEY_MEDIA_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/constants";
import type { JourneyMedia } from "@/lib/types";

/** Photos and videos, newest first, each with a short-lived signed URL. */
export async function listJourneyMedia(): Promise<JourneyMedia[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("journey_media")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const items = (data ?? []) as JourneyMedia[];
  if (items.length === 0) return items;

  // The bucket is private, exactly like profile photos, so nothing is
  // reachable without a signed URL minted on this render.
  const { data: signed, error: signError } = await supabase.storage
    .from(JOURNEY_MEDIA_BUCKET)
    .createSignedUrls(
      items.map((m) => m.storage_path),
      SIGNED_URL_TTL_SECONDS
    );
  if (signError) throw signError;

  return items.map((m, i) => ({ ...m, signedUrl: signed?.[i]?.signedUrl ?? undefined }));
}

export async function uploadJourneyMedia(file: File, caption?: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(JOURNEY_MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { error } = await supabase.from("journey_media").insert({
    storage_path: path,
    file_name: file.name,
    content_type: file.type || null,
    size_bytes: file.size,
    caption: caption?.trim() || null,
  });
  if (error) throw error;
}

export async function deleteJourneyMedia(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: item, error: fetchError } = await supabase
    .from("journey_media")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;

  await supabase.storage.from(JOURNEY_MEDIA_BUCKET).remove([item.storage_path]);

  const { error } = await supabase.from("journey_media").delete().eq("id", id);
  if (error) throw error;
}
