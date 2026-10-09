import "server-only";
import {
  anyOf,
  countRows,
  deleteMany,
  gte,
  ilike,
  insertMany,
  insertOne,
  notNull,
  overlaps,
  selectColumn,
  selectMany,
  selectOne,
  updateMany,
  updateOne,
  type Filters,
} from "@/lib/db";
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
 * The filters, as a `Filters` object the CRUD layer turns into SQL.
 *
 * Shared by the list and the count so the two can never disagree about what
 * "matching" means — a count that drifts from its list is worse than no count.
 */
function profileFilters(filters: ProfileFilters): Filters {
  const where: Filters = {
    is_active: true,
    // Soft-deleted profiles are invisible to every list; the Deleted page has
    // its own query rather than a flag threaded through this one.
    deleted_at: null,
  };
  const and: Filters["$raw"] = [];

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    where.$or = [
      { full_name: ilike(term) },
      { city: ilike(term) },
      { profession: ilike(term) },
      { religion: ilike(term) },
      { caste: ilike(term) },
    ];
  }
  if (filters.gender) where.gender = filters.gender;
  if (filters.city) where.city = ilike(`%${filters.city}%`);
  if (filters.religion) where.religion = filters.religion;
  if (filters.caste) where.caste = ilike(`%${filters.caste}%`);
  if (filters.anurupaAura) where.anurupa_aura = true;
  if (filters.urgent) where.urgent = true;
  if (filters.professionCategory) where.profession_category = filters.professionCategory;
  if (filters.minHeight) where.height_cm = gte(filters.minHeight);
  if (filters.maxHeight) {
    and.push({ sql: "height_cm <= ?", params: [filters.maxHeight] });
  }
  if (filters.minFinances) where.annual_income_inr = gte(filters.minFinances);
  if (filters.maxFinances) {
    and.push({ sql: "annual_income_inr <= ?", params: [filters.maxFinances] });
  }
  if (filters.tags?.length) where.tags = overlaps(filters.tags);

  // Older DOB = older age, so maxAge bounds the earliest birthdate and minAge
  // the latest. Both ends can apply at once, as can a birth year, so they go
  // in as fragments rather than fighting over the one `dob` key.
  if (filters.minAge) {
    and.push({ sql: "dob <= ?", params: [dobFromAge(filters.minAge)] });
  }
  if (filters.maxAge) {
    and.push({ sql: "dob >= ?", params: [dobFromAge(filters.maxAge)] });
  }
  if (filters.birthYear) {
    and.push({ sql: "extract(year from dob) = ?", params: [filters.birthYear] });
  }

  if (filters.potentialClient) {
    and.push({
      sql: "(sibling1_potential_client = true or sibling2_potential_client = true)",
    });
  }

  if (and.length > 0) where.$raw = and;
  return where;
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
  const where = profileFilters(filters);

  const [profiles, total] = await Promise.all([
    selectMany<Profile>("profiles", {
      where,
      orderBy: "created_at desc",
      limit: pageSize,
      offset: Math.max(0, page - 1) * pageSize,
    }),
    countRows("profiles", where),
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
  const profile = await selectOne<Profile>("profiles", { where: { id } });
  if (!profile) return null;

  const photos = await selectMany<ProfilePhoto>("profile_photos", {
    where: { profile_id: id },
    orderBy: "sort_order asc",
  });

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
    selectMany<Profile>("profiles", {
      where: { deleted_at: null, id: anyOf(ids, "uuid") },
    }),
    selectMany<ProfilePhoto>("profile_photos", {
      where: { profile_id: anyOf(ids, "uuid") },
      orderBy: "sort_order asc",
    }),
  ]);

  const signedPhotos = attachSignedPhotoUrls(photos);

  return profiles.map((profile) => ({
    ...profile,
    photos: signedPhotos.filter((p) => p.profile_id === profile.id),
  }));
}

export async function createProfile(values: ProfileFormValues): Promise<Profile> {
  return insertOne<Profile>("profiles", values);
}

export async function updateProfile(
  id: string,
  values: Partial<ProfileFormValues>
): Promise<Profile> {
  return updateOne<Profile>(
    "profiles",
    { ...values, updated_at: new Date().toISOString() },
    { id }
  );
}

/**
 * Hides a profile without destroying it. Everything that references it -
 * share links, shortlists, photos - is left intact, so restoring brings the
 * whole record back exactly as it was.
 */
export async function softDeleteProfile(id: string): Promise<void> {
  await updateMany("profiles", { deleted_at: new Date().toISOString() }, { id });
}

export async function restoreProfile(id: string): Promise<void> {
  await updateMany("profiles", { deleted_at: null }, { id });
}

export async function listDeletedProfiles(): Promise<Profile[]> {
  return selectMany<Profile>("profiles", {
    where: { deleted_at: notNull() },
    orderBy: "deleted_at desc",
  });
}

/** Permanent. Removes the photos from storage first, then the row. */
export async function deleteProfile(id: string): Promise<void> {
  const paths = await selectColumn<string>("profile_photos", "storage_path", {
    where: { profile_id: id },
  });

  await deleteBlobs(PROFILE_PHOTOS_CONTAINER, paths);
  await deleteMany("profiles", { id });
}

export async function getDistinctCities(): Promise<string[]> {
  return selectColumn<string>("profiles", "city", {
    columns: "distinct city",
    where: { city: notNull() },
    orderBy: "city",
  } as never);
}

/** Birth years present in the book, newest first, for the All Profiles filter. */
export async function listProfileBirthYears(gender?: string): Promise<number[]> {
  // Grouped in the database rather than by reading every dob into memory and
  // de-duplicating here, which is what the thousand-row page cap used to force.
  const rows = await selectMany<{ year: number }>("profiles", {
    columns: "distinct extract(year from dob)::int as year",
    where: {
      is_active: true,
      deleted_at: null,
      dob: notNull(),
      ...(gender ? { gender } : {}),
    },
    orderBy: "year desc",
  });
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

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    try {
      await insertMany("profiles", chunk, {
        chunkSize,
        conflict: {
          onConflict: "source_id",
          update: true,
          alsoSet: { updated_at: "now()" },
        },
      });
      result.written += chunk.length;
    } catch (error) {
      // A chunk that fails is reported row by row and the import carries on,
      // rather than one bad row losing the whole file.
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
  return countRows("profiles", { source_id: anyOf(sourceIds) });
}
