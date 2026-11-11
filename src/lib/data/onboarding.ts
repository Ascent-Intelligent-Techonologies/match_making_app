import "server-only";
import { countRows, gte, insertOne, lt, selectMany, selectOne, updateMany } from "@/lib/db";
import { beginPhotoUpload, finalisePhotoUpload, type UploadTicket } from "@/lib/data/photos";
import { deleteProfile } from "@/lib/data/profiles";
import {
  SELF_ONBOARD_DAILY_CAP,
  SELF_ONBOARD_DRAFT_TTL_HOURS,
  SELF_ONBOARD_MAX_PHOTOS,
  SELF_ONBOARD_MAX_PHOTO_BYTES,
} from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { selfOnboardingSchema, type SelfOnboardingValues } from "@/lib/validation";

/**
 * Self-onboarding, from the public form to the admin's queue.
 *
 * A submission is three steps, because photos go straight to Blob Storage and
 * need a profile to belong to:
 *   1. createDraft: the details become a "draft" profile.
 *   2. photos are attached to the draft (beginPhoto / finalisePhoto).
 *   3. submit: with at least one photo, the draft becomes "pending".
 * Nothing here ever makes a profile "approved"; only an admin does that.
 */

/**
 * An error whose message is safe to show a stranger. Anything else thrown on
 * this path (a database error, say) is logged and replaced with a generic
 * message by the caller, so internals never reach the public form.
 */
export class OnboardingError extends Error {}

/** Only a profile that came from this form and has not been submitted yet. */
async function requireDraft(profileId: string): Promise<void> {
  const draft = await selectOne<{ id: string }>("profiles", {
    columns: "id",
    where: {
      id: profileId,
      approval_status: "draft",
      self_onboarded: true,
      deleted_at: null,
    },
  });
  if (!draft) {
    throw new OnboardingError(
      "This form is no longer open for changes. Please start again."
    );
  }
}

/** Step 1: the person's details, saved as a draft no admin sees yet. */
export async function createDraft(values: SelfOnboardingValues): Promise<Profile> {
  // A ceiling on new sign-ups across everyone, so a script rotating addresses
  // still cannot fill the book and the photo storage with junk.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recent = await countRows("profiles", {
    self_onboarded: true,
    created_at: gte(since),
  });
  if (recent >= SELF_ONBOARD_DAILY_CAP) {
    throw new OnboardingError(
      "We are receiving a lot of sign-ups right now. Please try again tomorrow."
    );
  }

  return insertOne<Profile>("profiles", {
    ...values,
    approval_status: "draft",
    self_onboarded: true,
  });
}

/** The same draft, with the details corrected: a retry after a photo failed to upload. */
export async function updateDraft(
  profileId: string,
  values: SelfOnboardingValues
): Promise<Profile> {
  await requireDraft(profileId);
  // Every field the form owns is written, an empty one as null, so a field the
  // person emptied since the first attempt does not keep its old value (a save
  // normally leaves a blank field alone). Only name is NOT NULL among them, and
  // it is always sent.
  const received: Record<string, unknown> = values;
  const everything = Object.fromEntries(
    Object.keys(selfOnboardingSchema.shape).map((field) => [field, received[field] ?? null])
  );
  const rows = await updateMany<Profile>(
    "profiles",
    { ...everything, updated_at: new Date().toISOString() },
    { id: profileId, approval_status: "draft" }
  );
  if (rows.length === 0) throw new OnboardingError("This form is no longer open for changes.");
  return rows[0];
}

/** Step 2a: a write-only URL for one photo, if the draft has room for it. */
export async function beginPhoto(
  profileId: string,
  file: { name: string; type: string; size: number }
): Promise<UploadTicket> {
  await requireDraft(profileId);

  const have = await countRows("profile_photos", { profile_id: profileId });
  if (have >= SELF_ONBOARD_MAX_PHOTOS) {
    throw new OnboardingError(`You can add up to ${SELF_ONBOARD_MAX_PHOTOS} photos.`);
  }

  try {
    return await beginPhotoUpload(profileId, file, SELF_ONBOARD_MAX_PHOTO_BYTES);
  } catch (error) {
    // Its messages ("x.pdf is not an image", "over the limit") are for the person.
    throw new OnboardingError(error instanceof Error ? error.message : "Could not start the upload.");
  }
}

/** Step 2b: after the upload, check it is an image and record it. */
export async function finalisePhoto(profileId: string, path: string): Promise<void> {
  await requireDraft(profileId);

  const have = await countRows("profile_photos", { profile_id: profileId });
  if (have >= SELF_ONBOARD_MAX_PHOTOS) {
    throw new OnboardingError(`You can add up to ${SELF_ONBOARD_MAX_PHOTOS} photos.`);
  }

  try {
    // No framing step on the public form: the admin can adjust it in review.
    await finalisePhotoUpload(profileId, path, null, SELF_ONBOARD_MAX_PHOTO_BYTES);
  } catch (error) {
    throw new OnboardingError(error instanceof Error ? error.message : "Upload failed.");
  }
}

/**
 * Step 3: hand the draft to the admins. A photo is required, and this is where
 * that is enforced: the form can be tampered with, this cannot.
 */
export async function submitDraft(profileId: string): Promise<void> {
  const profile = await selectOne<Pick<Profile, "approval_status" | "self_onboarded">>(
    "profiles",
    { columns: "approval_status, self_onboarded", where: { id: profileId, deleted_at: null } }
  );
  if (!profile || !profile.self_onboarded) {
    throw new OnboardingError("This form is no longer open. Please start again.");
  }
  // A retried submit after a slow network: already done, so done.
  if (profile.approval_status === "pending") return;
  if (profile.approval_status !== "draft") {
    throw new OnboardingError("This form is no longer open. Please start again.");
  }

  const photos = await countRows("profile_photos", { profile_id: profileId });
  if (photos === 0) throw new OnboardingError("Please add at least one photo.");

  const now = new Date().toISOString();
  await updateMany(
    "profiles",
    { approval_status: "pending", submitted_at: now, updated_at: now },
    { id: profileId, approval_status: "draft" }
  );
}

/**
 * Removes drafts nobody finished (a closed tab, a failed upload), with their
 * photos. Called whenever a new sign-up starts, so there is no scheduled job to
 * keep running, and only ever touches "draft" rows from this form: nothing an
 * admin has seen.
 */
export async function purgeStaleDrafts(limit = 20): Promise<void> {
  const cutoff = new Date(
    Date.now() - SELF_ONBOARD_DRAFT_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();
  const stale = await selectMany<{ id: string }>("profiles", {
    columns: "id",
    where: { approval_status: "draft", self_onboarded: true, created_at: lt(cutoff) },
    limit,
  });
  for (const { id } of stale) {
    await deleteProfile(id);
  }
}
