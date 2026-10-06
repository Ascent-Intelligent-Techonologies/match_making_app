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
  minAge?: number;
  maxAge?: number;
  caste?: string;
  /** Matches a profile carrying ANY of these tags. */
  tags?: string[];
  anurupaAura?: boolean;
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

/** The chainable filter builder the two profile queries share. */
type ProfileQuery = ReturnType<
  ReturnType<ReturnType<typeof getSupabaseAdmin>["from"]>["select"]
>;

/** How many profiles a list shows at once. */
export const PROFILE_PAGE_SIZE = 60;

export interface ProfilePage {
  profiles: Profile[];
  /** Matching the filters, not just on this page. */
  total: number;
}

/**
 * The filters, applied to any query over profiles.
 *
 * Shared by the list and the count so the two can never disagree about what
 * "matching" means — a count that drifts from its list is worse than no count.
 */
function applyProfileFilters<Q extends ProfileQuery>(query: Q, filters: ProfileFilters): Q {
  let q = query;

  if (filters.search) {
    const term = filters.search.trim();
    q = q.or(
      `full_name.ilike.%${term}%,city.ilike.%${term}%,profession.ilike.%${term}%,religion.ilike.%${term}%,caste.ilike.%${term}%`
    ) as Q;
  }
  if (filters.gender) q = q.eq("gender", filters.gender) as Q;
  if (filters.city) q = q.ilike("city", `%${filters.city}%`) as Q;
  if (filters.religion) q = q.eq("religion", filters.religion) as Q;
  // Older DOB = older age, so maxAge bounds the earliest birthdate and minAge the latest.
  if (filters.minAge) q = q.lte("dob", dobFromAge(filters.minAge)) as Q;
  if (filters.maxAge) q = q.gte("dob", dobFromAge(filters.maxAge)) as Q;
  if (filters.caste) q = q.ilike("caste", `%${filters.caste}%`) as Q;
  if (filters.tags?.length) q = q.overlaps("tags", filters.tags) as Q;
  if (filters.anurupaAura) q = q.eq("anurupa_aura", true) as Q;
  if (filters.minHeight) q = q.gte("height_cm", filters.minHeight) as Q;
  if (filters.maxHeight) q = q.lte("height_cm", filters.maxHeight) as Q;
  if (filters.minFinances) q = q.gte("annual_income_inr", filters.minFinances) as Q;
  if (filters.maxFinances) q = q.lte("annual_income_inr", filters.maxFinances) as Q;
  if (filters.professionCategory) {
    q = q.eq("profession_category", filters.professionCategory) as Q;
  }
  if (filters.urgent) q = q.eq("urgent", true) as Q;
  if (filters.potentialClient) {
    q = q.or("sibling1_potential_client.eq.true,sibling2_potential_client.eq.true") as Q;
  }
  if (filters.birthYear) {
    q = q
      .gte("dob", `${filters.birthYear}-01-01`)
      .lte("dob", `${filters.birthYear}-12-31`) as Q;
  }
  return q;
}

/**
 * One page of profiles, plus how many match in total.
 *
 * Paged rather than unbounded: PostgREST stops at a thousand rows, so an
 * unbounded list quietly showed part of the book and counted it as the whole
 * thing. The total comes from the database, so the page can say how much more
 * there is.
 */
export async function listProfilePage(
  filters: ProfileFilters = {},
  page = 1,
  pageSize = PROFILE_PAGE_SIZE
): Promise<ProfilePage> {
  const supabase = getSupabaseAdmin();
  const from = Math.max(0, page - 1) * pageSize;

  const query = applyProfileFilters(
    supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .eq("is_active", true)
      // Soft-deleted profiles are invisible to every list; the Deleted page
      // has its own query rather than a flag threaded through this one.
      .is("deleted_at", null),
    filters
  )
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { profiles: data ?? [], total: count ?? 0 };
}

/** Every match, for the places that genuinely need them all. Capped for safety. */
export async function listProfiles(
  filters: ProfileFilters = {},
  limit = PROFILE_PAGE_SIZE
): Promise<Profile[]> {
  const { profiles } = await listProfilePage(filters, 1, limit);
  return profiles;
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

export interface BulkUpsertResult {
  written: number;
  failed: { sourceId: string; message: string }[];
}

/**
 * Writes imported profiles, keyed on where they came from.
 *
 * Upserting on source_id makes re-running an import safe: the second run
 * updates the rows the first one created rather than doubling the book.
 *
 * Sent in chunks because a single statement carrying thousands of rows is one
 * thing that can time out and lose everything; a failed chunk is reported and
 * the rest still land.
 */
export async function bulkUpsertProfilesBySourceId(
  rows: (ProfileFormValues & { source_id: string })[],
  chunkSize = 250
): Promise<BulkUpsertResult> {
  const supabase = getSupabaseAdmin();
  const result: BulkUpsertResult = { written: 0, failed: [] };

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("profiles")
      .upsert(chunk, { onConflict: "source_id" });

    if (error) {
      for (const row of chunk) {
        result.failed.push({ sourceId: row.source_id, message: error.message });
      }
      continue;
    }
    result.written += chunk.length;
  }

  return result;
}

/** How many of these source ids are already on the books. */
export async function countExistingSourceIds(sourceIds: string[]): Promise<number> {
  if (sourceIds.length === 0) return 0;
  const supabase = getSupabaseAdmin();

  let found = 0;
  // Chunked to keep the `in` list out of URL-length territory.
  for (let i = 0; i < sourceIds.length; i += 200) {
    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("source_id", sourceIds.slice(i, i + 200));
    if (error) throw error;
    found += count ?? 0;
  }
  return found;
}
