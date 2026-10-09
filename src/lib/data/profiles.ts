import "server-only";
import { buildInsert, buildUpdate, count, execute, maybeOne, one, query } from "@/lib/db";
import { deleteBlobs, signedUrl } from "@/lib/storage/blob";
import { PROFILE_PHOTOS_CONTAINER, SIGNED_URL_TTL_SECONDS } from "@/lib/constants";
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

/** How many profiles a list shows at once. */
export const PROFILE_PAGE_SIZE = 60;

export interface ProfilePage {
  profiles: Profile[];
  /** Matching the filters, not just on this page. */
  total: number;
}

/**
 * The filters, as a list of SQL conditions and the values they bind.
 *
 * Shared by the list and the count so the two can never disagree about what
 * "matching" means — a count that drifts from its list is worse than no count.
 * Every value is a bound parameter; nothing is interpolated into the SQL.
 */
function profileConditions(filters: ProfileFilters): {
  where: string;
  params: unknown[];
} {
  const clauses: string[] = ["is_active = true", "deleted_at is null"];
  const params: unknown[] = [];

  const bind = (value: unknown): string => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    const p = bind(term);
    clauses.push(
      `(full_name ilike ${p} or city ilike ${p} or profession ilike ${p}
        or religion ilike ${p} or caste ilike ${p})`
    );
  }
  if (filters.gender) clauses.push(`gender = ${bind(filters.gender)}`);
  if (filters.city) clauses.push(`city ilike ${bind(`%${filters.city}%`)}`);
  if (filters.religion) clauses.push(`religion = ${bind(filters.religion)}`);
  // Older DOB = older age, so maxAge bounds the earliest birthdate and minAge the latest.
  if (filters.minAge) clauses.push(`dob <= ${bind(dobFromAge(filters.minAge))}`);
  if (filters.maxAge) clauses.push(`dob >= ${bind(dobFromAge(filters.maxAge))}`);
  if (filters.caste) clauses.push(`caste ilike ${bind(`%${filters.caste}%`)}`);
  // && is "arrays overlap": carries any one of these tags.
  if (filters.tags?.length) clauses.push(`tags && ${bind(filters.tags)}::text[]`);
  if (filters.anurupaAura) clauses.push("anurupa_aura = true");
  if (filters.minHeight) clauses.push(`height_cm >= ${bind(filters.minHeight)}`);
  if (filters.maxHeight) clauses.push(`height_cm <= ${bind(filters.maxHeight)}`);
  if (filters.minFinances) clauses.push(`annual_income_inr >= ${bind(filters.minFinances)}`);
  if (filters.maxFinances) clauses.push(`annual_income_inr <= ${bind(filters.maxFinances)}`);
  if (filters.professionCategory) {
    clauses.push(`profession_category = ${bind(filters.professionCategory)}`);
  }
  if (filters.urgent) clauses.push("urgent = true");
  if (filters.potentialClient) {
    clauses.push("(sibling1_potential_client = true or sibling2_potential_client = true)");
  }
  if (filters.birthYear) {
    clauses.push(`dob >= ${bind(`${filters.birthYear}-01-01`)}`);
    clauses.push(`dob <= ${bind(`${filters.birthYear}-12-31`)}`);
  }

  return { where: clauses.join(" and "), params };
}

/**
 * One page of profiles, plus how many match in total.
 *
 * Paged rather than unbounded: the book runs to thousands of profiles, and
 * rendering all of them to show sixty is seconds of work thrown away. The
 * total comes from the database, so the page can say how much more there is.
 */
export async function listProfilePage(
  filters: ProfileFilters = {},
  page = 1,
  pageSize = PROFILE_PAGE_SIZE
): Promise<ProfilePage> {
  const offset = Math.max(0, page - 1) * pageSize;
  const { where, params } = profileConditions(filters);

  const [profiles, total] = await Promise.all([
    query<Profile>(
      `select * from profiles
        where ${where}
        order by created_at desc
        limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, pageSize, offset]
    ),
    count(`select count(*) from profiles where ${where}`, params),
  ]);

  return { profiles, total };
}

/** Every match, for the places that genuinely need them all. Capped for safety. */
export async function listProfiles(
  filters: ProfileFilters = {},
  limit = PROFILE_PAGE_SIZE
): Promise<Profile[]> {
  const { profiles } = await listProfilePage(filters, 1, limit);
  return profiles;
}

function attachSignedPhotoUrls(photos: ProfilePhoto[]): ProfilePhoto[] {
  return photos.map((photo) => ({
    ...photo,
    signedUrl: signedUrl(
      PROFILE_PHOTOS_CONTAINER,
      photo.storage_path,
      SIGNED_URL_TTL_SECONDS
    ),
  }));
}

/**
 * One profile for the admin editor. Soft-deleted rows are included on purpose:
 * the admin may still need to look at what they removed before restoring it.
 * Anything client-facing goes through getPublicProfileWithPhotos instead.
 */
export async function getProfileWithPhotos(id: string): Promise<ProfileWithPhotos | null> {
  const profile = await maybeOne<Profile>("select * from profiles where id = $1", [id]);
  if (!profile) return null;

  const photos = await query<ProfilePhoto>(
    "select * from profile_photos where profile_id = $1 order by sort_order asc",
    [id]
  );

  return { ...profile, photos: attachSignedPhotoUrls(photos) };
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

  const [profiles, photos] = await Promise.all([
    query<Profile>(
      "select * from profiles where deleted_at is null and id = any($1::uuid[])",
      [ids]
    ),
    query<ProfilePhoto>(
      `select * from profile_photos
        where profile_id = any($1::uuid[])
        order by sort_order asc`,
      [ids]
    ),
  ]);

  const signedPhotos = attachSignedPhotoUrls(photos);

  return profiles.map((profile) => ({
    ...profile,
    photos: signedPhotos.filter((p) => p.profile_id === profile.id),
  }));
}

export async function createProfile(values: ProfileFormValues): Promise<Profile> {
  const { text, params } = buildInsert("profiles", values);
  return one<Profile>(text, params);
}

export async function updateProfile(
  id: string,
  values: Partial<ProfileFormValues>
): Promise<Profile> {
  const { text, params } = buildUpdate(
    "profiles",
    { ...values, updated_at: new Date().toISOString() },
    { column: "id", value: id }
  );
  return one<Profile>(text, params);
}

/**
 * Hides a profile without destroying it. Everything that references it -
 * share links, shortlists, photos - is left intact, so restoring brings the
 * whole record back exactly as it was.
 */
export async function softDeleteProfile(id: string): Promise<void> {
  await execute("update profiles set deleted_at = now() where id = $1", [id]);
}

export async function restoreProfile(id: string): Promise<void> {
  await execute("update profiles set deleted_at = null where id = $1", [id]);
}

export async function listDeletedProfiles(): Promise<Profile[]> {
  return query<Profile>(
    "select * from profiles where deleted_at is not null order by deleted_at desc"
  );
}

/** Permanent. Removes the photos from storage first, then the row. */
export async function deleteProfile(id: string): Promise<void> {
  const photos = await query<{ storage_path: string }>(
    "select storage_path from profile_photos where profile_id = $1",
    [id]
  );

  await deleteBlobs(
    PROFILE_PHOTOS_CONTAINER,
    photos.map((p) => p.storage_path)
  );

  await execute("delete from profiles where id = $1", [id]);
}

export async function getDistinctCities(): Promise<string[]> {
  const rows = await query<{ city: string }>(
    "select distinct city from profiles where city is not null order by city"
  );
  return rows.map((r) => r.city);
}

/** Birth years present in the book, newest first, for the All Profiles filter. */
export async function listProfileBirthYears(gender?: string): Promise<number[]> {
  // Grouped in the database rather than by reading every dob into memory and
  // de-duplicating here, which is what the thousand-row page cap used to force.
  const rows = await query<{ year: number }>(
    `select distinct extract(year from dob)::int as year
       from profiles
      where is_active = true and deleted_at is null and dob is not null
        and ($1::text is null or gender = $1)
      order by year desc`,
    [gender ?? null]
  );
  return rows.map((r) => r.year);
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
  const result: BulkUpsertResult = { written: 0, failed: [] };
  if (rows.length === 0) return result;

  // Every row is written with the same column list, so a row that happens to
  // leave a field blank still overwrites it rather than keeping a stale value
  // from a previous import.
  const columns = Array.from(
    new Set(rows.flatMap((row) => Object.keys(row).filter((k) => row[k as keyof typeof row] !== undefined)))
  );
  const updates = columns
    .filter((c) => c !== "source_id")
    .map((c) => `${c} = excluded.${c}`)
    .concat("updated_at = now()");

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

    const params: unknown[] = [];
    const tuples = chunk.map((row) => {
      const placeholders = columns.map((column) => {
        params.push(row[column as keyof typeof row] ?? null);
        return `$${params.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });

    try {
      await execute(
        `insert into profiles (${columns.join(", ")})
         values ${tuples.join(", ")}
         on conflict (source_id) do update set ${updates.join(", ")}`,
        params
      );
      result.written += chunk.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const row of chunk) {
        result.failed.push({ sourceId: row.source_id, message });
      }
    }
  }

  return result;
}

/** How many of these source ids are already on the books. */
export async function countExistingSourceIds(sourceIds: string[]): Promise<number> {
  if (sourceIds.length === 0) return 0;
  return count("select count(*) from profiles where source_id = any($1::text[])", [sourceIds]);
}
