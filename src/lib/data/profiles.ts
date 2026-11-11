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
  query,
  selectColumn,
  selectMany,
  selectOne,
  updateMany,
  updateOne,
  type Filters,
} from "@/lib/db";
import { deleteBlobs } from "@/lib/storage/blob";
import { photoBlobPaths, withPhotoUrls } from "@/lib/data/photos";
import { PROFILE_PHOTOS_CONTAINER } from "@/lib/constants";
import { normalizePhone } from "@/lib/phone";
import type { ApprovalStatus, Profile, ProfilePhoto, ProfileWithPhotos } from "@/lib/types";
import type { ProfileFormValues } from "@/lib/validation";

export interface ProfileFilters {
  search?: string;
  /**
   * Let the search text match the surname too, including "name surname" typed
   * together. Admin screens only: clients browsing never see a surname, so
   * letting them search by one would reveal which profiles share it.
   */
  includeSurname?: boolean;
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
  /** Born in or after / in or before this year. */
  minBirthYear?: number;
  maxBirthYear?: number;
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
    // Nor does anything show a profile that is still waiting for an admin (or
    // was declined). Every list that reaches clients, and every admin list
    // except Approvals, comes through here.
    approval_status: "approved",
  };
  const and: Filters["$raw"] = [];

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    where.$or = [
      // Matched against "name surname" as the admin screens show it, so either
      // part or both together find the profile.
      filters.includeSurname
        ? { $raw: [{ sql: "concat_ws(' ', full_name, surname) ilike ?", params: [term] }] }
        : { full_name: ilike(term) },
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
  // the latest. Both ends can apply at once, as can a birth year range, so they
  // go in as fragments rather than fighting over the one `dob` key.
  if (filters.minAge) {
    and.push({ sql: "dob <= ?", params: [dobFromAge(filters.minAge)] });
  }
  if (filters.maxAge) {
    and.push({ sql: "dob >= ?", params: [dobFromAge(filters.maxAge)] });
  }
  if (filters.minBirthYear) {
    and.push({ sql: "extract(year from dob) >= ?", params: [filters.minBirthYear] });
  }
  if (filters.maxBirthYear) {
    and.push({ sql: "extract(year from dob) <= ?", params: [filters.maxBirthYear] });
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
  return photos.map(withPhotoUrls);
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

/**
 * The same profile, but never a soft-deleted one, nor one that has not been
 * approved — used by the public pages.
 */
export async function getPublicProfileWithPhotos(
  id: string
): Promise<ProfileWithPhotos | null> {
  const profile = await getProfileWithPhotos(id);
  return profile && !profile.deleted_at && profile.approval_status === "approved"
    ? profile
    : null;
}

export async function getManyProfilesWithPhotos(
  ids: string[]
): Promise<ProfileWithPhotos[]> {
  if (ids.length === 0) return [];

  const [profiles, photos] = await Promise.all([
    selectMany<Profile>("profiles", {
      where: { deleted_at: null, approval_status: "approved", id: anyOf(ids, "uuid") },
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

  await deleteBlobs(PROFILE_PHOTOS_CONTAINER, photoBlobPaths(paths));
  await deleteMany("profiles", { id });
}

export async function getDistinctCities(): Promise<string[]> {
  return selectColumn<string>("profiles", "city", {
    columns: "distinct city",
    where: { city: notNull(), deleted_at: null, approval_status: "approved" },
    orderBy: "city",
  } as never);
}

// ------------------------------------------------------------- approvals --
//
// Self-onboarded profiles wait here. Nothing above this line ever returns one:
// the lists add `approval_status = 'approved'`, and the single-profile reads
// for clients check it. The admin editor reads a profile by id whatever its
// status, which is how it is reviewed.

/** Profiles waiting for a decision ("pending") or turned down ("rejected"), newest first. */
export async function listProfilesByApproval(
  status: Extract<ApprovalStatus, "pending" | "rejected">
): Promise<Profile[]> {
  return selectMany<Profile>("profiles", {
    where: { approval_status: status, deleted_at: null },
    orderBy: "coalesce(reviewed_at, submitted_at, created_at) desc",
  });
}

/** How many are waiting for an admin; the badge on the Approvals card. */
export async function countPendingProfiles(): Promise<number> {
  return countRows("profiles", { approval_status: "pending", deleted_at: null });
}

/**
 * Approves or declines a profile that is waiting (or was declined earlier and
 * is being reconsidered). Null when the profile is not in a state that allows
 * it, so a stale page cannot approve something twice or revive a draft.
 */
export async function setProfileApproval(
  id: string,
  status: Extract<ApprovalStatus, "approved" | "rejected">
): Promise<Profile | null> {
  const now = new Date().toISOString();
  const allowedFrom = status === "approved" ? ["pending", "rejected"] : ["pending"];
  const rows = await updateMany<Profile>(
    "profiles",
    { approval_status: status, reviewed_at: now, updated_at: now },
    { id, approval_status: anyOf(allowedFrom), deleted_at: null }
  );
  return rows[0] ?? null;
}

export interface PhoneMatch {
  id: string;
  full_name: string;
  surname: string | null;
}

/**
 * Live profiles that already have this phone number, so a reviewer can tell a
 * duplicate sign-up (or someone who is already on the books) at a glance.
 * Compared the way clients are keyed: digits only, last ten.
 */
export async function findLiveProfilesWithPhone(
  phone: string | null | undefined,
  excludeId: string
): Promise<PhoneMatch[]> {
  const digits = normalizePhone(phone ?? "");
  if (digits.length < 10) return [];
  return query<PhoneMatch>(
    `select id, full_name, surname
       from profiles
      where deleted_at is null
        and approval_status = 'approved'
        and id <> $1
        and right(regexp_replace(coalesce(contact_phone, ''), '\\D', '', 'g'), 10) = $2
      order by created_at
      limit 5`,
    [excludeId, digits]
  );
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
