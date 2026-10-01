import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PROFILE_PHOTOS_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/constants";
import type { Profile, ProfilePhoto, ProfileWithPhotos } from "@/lib/types";
import type { ProfileFormValues } from "@/lib/validation";

export interface ProfileFilters {
  search?: string;
  gender?: string;
  city?: string;
  religion?: string;
  maritalStatus?: string;
  diet?: string;
  manglik?: string;
  minAge?: number;
  maxAge?: number;
  minIncome?: number;
  caste?: string;
  tag?: string;
  minHeight?: number;
  maxHeight?: number;
  minFinances?: number;
  maxFinances?: number;
}

function dobFromAge(age: number): string {
  const now = new Date();
  return new Date(now.getFullYear() - age, now.getMonth(), now.getDate())
    .toISOString()
    .slice(0, 10);
}

export async function listProfiles(filters: ProfileFilters = {}): Promise<Profile[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("profiles")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (filters.search) {
    const term = filters.search.trim();
    query = query.or(
      `full_name.ilike.%${term}%,city.ilike.%${term}%,profession.ilike.%${term}%,religion.ilike.%${term}%,caste.ilike.%${term}%`
    );
  }
  if (filters.gender) query = query.eq("gender", filters.gender);
  if (filters.city) query = query.ilike("city", `%${filters.city}%`);
  if (filters.religion) query = query.eq("religion", filters.religion);
  if (filters.maritalStatus) query = query.eq("marital_status", filters.maritalStatus);
  if (filters.diet) query = query.eq("diet", filters.diet);
  if (filters.manglik) query = query.eq("manglik", filters.manglik);
  // Older DOB = older age, so maxAge bounds the earliest birthdate and minAge the latest.
  if (filters.minAge) query = query.lte("dob", dobFromAge(filters.minAge));
  if (filters.maxAge) query = query.gte("dob", dobFromAge(filters.maxAge));
  if (filters.minIncome) query = query.gte("annual_income_inr", filters.minIncome);
  if (filters.caste) query = query.ilike("caste", `%${filters.caste}%`);
  if (filters.tag) query = query.eq("tag", filters.tag);
  if (filters.minHeight) query = query.gte("height_cm", filters.minHeight);
  if (filters.maxHeight) query = query.lte("height_cm", filters.maxHeight);
  if (filters.minFinances) query = query.gte("annual_income_inr", filters.minFinances);
  if (filters.maxFinances) query = query.lte("annual_income_inr", filters.maxFinances);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function attachSignedPhotoUrls(photos: ProfilePhoto[]): Promise<ProfilePhoto[]> {
  if (photos.length === 0) return photos;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .createSignedUrls(
      photos.map((p) => p.storage_path),
      SIGNED_URL_TTL_SECONDS
    );
  if (error) throw error;

  return photos.map((photo, i) => ({
    ...photo,
    signedUrl: data?.[i]?.signedUrl ?? undefined,
  }));
}

export async function getProfileWithPhotos(id: string): Promise<ProfileWithPhotos | null> {
  const supabase = getSupabaseAdmin();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return null;

  const { data: photos, error: photosError } = await supabase
    .from("profile_photos")
    .select("*")
    .eq("profile_id", id)
    .order("sort_order", { ascending: true });
  if (photosError) throw photosError;

  return { ...profile, photos: await attachSignedPhotoUrls(photos ?? []) };
}

export async function getManyProfilesWithPhotos(
  ids: string[]
): Promise<ProfileWithPhotos[]> {
  if (ids.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*")
    .in("id", ids);
  if (error) throw error;

  const { data: photos, error: photosError } = await supabase
    .from("profile_photos")
    .select("*")
    .in("profile_id", ids)
    .order("sort_order", { ascending: true });
  if (photosError) throw photosError;

  const signedPhotos = await attachSignedPhotoUrls(photos ?? []);

  return (profiles ?? []).map((profile) => ({
    ...profile,
    photos: signedPhotos.filter((p) => p.profile_id === profile.id),
  }));
}

export async function createProfile(values: ProfileFormValues): Promise<Profile> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .insert(values)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  id: string,
  values: Partial<ProfileFormValues>
): Promise<Profile> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProfile(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { data: photos, error: photosError } = await supabase
    .from("profile_photos")
    .select("storage_path")
    .eq("profile_id", id);
  if (photosError) throw photosError;

  if (photos && photos.length > 0) {
    await supabase.storage
      .from(PROFILE_PHOTOS_BUCKET)
      .remove(photos.map((p) => p.storage_path));
  }

  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) throw error;
}

export async function getDistinctCities(): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("city")
    .not("city", "is", null);
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((r) => r.city as string))).sort();
}
