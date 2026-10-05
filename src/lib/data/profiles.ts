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
  birthYear?: number;
  professionCategory?: string;
  urgent?: boolean;
  /** Profiles with a sibling marked as a potential client of our own. */
  potentialClient?: boolean;
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

  // Soft-deleted profiles are invisible to every list; the Deleted page has
  // its own query rather than a flag threaded through this one.
  query = query.is("deleted_at", null);

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
  if (filters.professionCategory) {
    query = query.eq("profession_category", filters.professionCategory);
  }
  if (filters.urgent) query = query.eq("urgent", true);
  if (filters.potentialClient) {
    query = query.or(
      "sibling1_potential_client.eq.true,sibling2_potential_client.eq.true"
    );
  }
  if (filters.birthYear) {
    query = query
      .gte("dob", `${filters.birthYear}-01-01`)
      .lte("dob", `${filters.birthYear}-12-31`);
  }

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

/**
 * One profile for the admin editor. Soft-deleted rows are included on purpose:
 * the admin may still need to look at what they removed before restoring it.
 * Anything client-facing goes through getPublicProfileWithPhotos instead.
 */
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

/** The same profile, but never a soft-deleted one — used by the public pages. */
export async function getPublicProfileWithPhotos(
  id: string
): Promise<ProfileWithPhotos | null> {
  const profile = await getProfileWithPhotos(id);
  return profile && !profile.deleted_at ? profile : null;
}

export async function getManyProfilesWithPhotos(
  ids: string[]
): Promise<ProfileWithPhotos[]> {
  if (ids.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*")
    .is("deleted_at", null)
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

/**
 * Hides a profile without destroying it. Everything that references it -
 * share links, shortlists, photos - is left intact, so restoring brings the
 * whole record back exactly as it was.
 */
export async function softDeleteProfile(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function restoreProfile(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("profiles")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) throw error;
}

export async function listDeletedProfiles(): Promise<Profile[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Permanent. Removes the photos from storage first, then the row. */
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


/** Birth years present in the book, newest first, for the All Profiles filter. */
export async function listProfileBirthYears(gender?: string): Promise<number[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("profiles")
    .select("dob")
    .eq("is_active", true)
    .is("deleted_at", null)
    .not("dob", "is", null);
  if (gender) query = query.eq("gender", gender);

  const { data, error } = await query;
  if (error) throw error;

  const years = new Set<number>();
  for (const row of data ?? []) {
    const y = Number(String(row.dob).slice(0, 4));
    if (Number.isFinite(y)) years.add(y);
  }
  return Array.from(years).sort((a, b) => b - a);
}
