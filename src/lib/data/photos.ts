import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PROFILE_PHOTOS_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/constants";
import type { ProfilePhoto } from "@/lib/types";

export async function uploadProfilePhoto(
  profileId: string,
  file: File
): Promise<ProfilePhoto> {
  const supabase = getSupabaseAdmin();

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${profileId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { count } = await supabase
    .from("profile_photos")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);

  const { data, error } = await supabase
    .from("profile_photos")
    .insert({
      profile_id: profileId,
      storage_path: path,
      sort_order: count ?? 0,
      is_cover: (count ?? 0) === 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProfilePhoto(photoId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { data: photo, error: fetchError } = await supabase
    .from("profile_photos")
    .select("storage_path")
    .eq("id", photoId)
    .single();
  if (fetchError) throw fetchError;

  await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove([photo.storage_path]);

  const { error } = await supabase.from("profile_photos").delete().eq("id", photoId);
  if (error) throw error;
}

export async function reorderProfilePhotos(orderedIds: string[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("profile_photos").update({ sort_order: index }).eq("id", id)
    )
  );
}

export async function setCoverPhoto(profileId: string, photoId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("profile_photos")
    .update({ is_cover: false })
    .eq("profile_id", profileId);
  const { error } = await supabase
    .from("profile_photos")
    .update({ is_cover: true })
    .eq("id", photoId);
  if (error) throw error;
}

/** Signed cover-photo URL per profile, for lightweight grid/list views. */
export async function getCoverPhotoUrls(profileIds: string[]): Promise<Map<string, string>> {
  if (profileIds.length === 0) return new Map();
  const supabase = getSupabaseAdmin();
  const { data: covers } = await supabase
    .from("profile_photos")
    .select("profile_id, storage_path")
    .in("profile_id", profileIds)
    .eq("is_cover", true);

  if (!covers || covers.length === 0) return new Map();

  const { data: signed } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .createSignedUrls(covers.map((c) => c.storage_path), SIGNED_URL_TTL_SECONDS);

  const map = new Map<string, string>();
  covers.forEach((c, i) => {
    const url = signed?.[i]?.signedUrl;
    if (url) map.set(c.profile_id, url);
  });
  return map;
}
