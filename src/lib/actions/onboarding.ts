"use server";

import { revalidatePath } from "next/cache";
import { selfOnboardingSchema } from "@/lib/validation";
import { parseProfileFormData } from "@/lib/profile-form-data";
import { signOnboardingToken, verifyOnboardingToken } from "@/lib/auth/onboarding-token";
import { isRateLimited, visitorAddress } from "@/lib/rate-limit";
import {
  beginPhoto,
  createDraft,
  finalisePhoto,
  OnboardingError,
  purgeStaleDrafts,
  submitDraft,
  updateDraft,
} from "@/lib/data/onboarding";
import type { UploadTicket } from "@/lib/data/photos";

/**
 * The public self-onboarding form's server side.
 *
 * Everything in this file is reachable by anyone, signed in or not, so each
 * action treats its arguments as hostile: they are validated, bounded and
 * rate limited here, and what they return is only what the form needs. The
 * only credential is the token minted by the first step, which is good for
 * one draft profile and nothing else (see signOnboardingToken).
 *
 * Deliberately separate from the admin actions: nothing here imports, or can
 * be mistaken for, anything that edits an existing profile.
 */

const HOUR_MS = 60 * 60 * 1000;
const GENERIC_ERROR = "Something went wrong. Please try again in a moment.";
const TOO_MANY = "Too many attempts. Please wait a little while and try again.";
const EXPIRED = "This form has expired. Please reload the page and start again.";
/** Far longer than any real answer; stops a request stuffed with text. */
const MAX_FIELD_LENGTH = 5000;

export type SaveDetailsResult =
  | { token: string }
  | { error: string; fieldErrors?: Record<string, string> };

export type TicketResult = { ticket: UploadTicket } | { error: string };

export type StepResult = { ok: true } | { error: string };

/** A message for the person: its own if it was written for them, a generic one if not. */
function failure(error: unknown): { error: string } {
  if (error instanceof OnboardingError) return { error: error.message };
  // Logged, never returned: a database error has no business on a public page.
  console.error("Self-onboarding failed:", error);
  return { error: GENERIC_ERROR };
}

/**
 * Step one: the details. Creates the draft profile (or, on a retry that comes
 * with the earlier token, corrects the same draft rather than making a second)
 * and returns the token that authorises the photo uploads.
 *
 * Name, phone and a usable birth date are checked here, by the schema; the
 * photo requirement is enforced when the submission is completed.
 */
export async function saveOnboardingDetailsAction(
  formData: FormData
): Promise<SaveDetailsResult> {
  try {
    // A real person never sees this field; something filling in every box does.
    if (String(formData.get("nickname_alt") ?? "").trim() !== "") {
      return { error: GENERIC_ERROR };
    }

    for (const [, value] of formData.entries()) {
      if (typeof value !== "string") return { error: "Photos are added separately." };
      if (value.length > MAX_FIELD_LENGTH) return { error: "One of the answers is too long." };
    }

    if (isRateLimited(`onboard:save:${await visitorAddress()}`, 12, HOUR_MS)) {
      return { error: TOO_MANY };
    }

    const parsed = selfOnboardingSchema.safeParse(parseProfileFormData(formData));
    if (!parsed.success) {
      return {
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
      };
    }

    const given = formData.get("_token");
    const existingId = given ? await verifyOnboardingToken(given) : null;
    if (given && !existingId) return { error: EXPIRED };

    let profileId: string;
    if (existingId) {
      await updateDraft(existingId, parsed.data);
      profileId = existingId;
    } else {
      // Housekeeping that rides along with a new sign-up, so nothing has to
      // be scheduled. Not waited for: it must not slow the person down.
      void purgeStaleDrafts().catch((error) => console.error("Draft cleanup failed:", error));
      profileId = (await createDraft(parsed.data)).id;
    }

    return { token: await signOnboardingToken(profileId) };
  } catch (error) {
    return failure(error);
  }
}

/** Step two (per photo): a write-only URL to upload one photo to. */
export async function requestOnboardingPhotoUploadAction(
  token: string,
  file: { name: string; type: string; size: number }
): Promise<TicketResult> {
  try {
    const profileId = await verifyOnboardingToken(token);
    if (!profileId) return { error: EXPIRED };

    const address = await visitorAddress();
    if (
      isRateLimited(`onboard:photo:${profileId}`, 20, HOUR_MS) ||
      isRateLimited(`onboard:photo-ip:${address}`, 60, HOUR_MS)
    ) {
      return { error: TOO_MANY };
    }

    return {
      ticket: await beginPhoto(profileId, {
        name: String(file?.name ?? "").slice(0, 200),
        type: String(file?.type ?? ""),
        size: Number(file?.size),
      }),
    };
  } catch (error) {
    return failure(error);
  }
}

/** Step two (per photo), after the upload: check it is an image and attach it. */
export async function finaliseOnboardingPhotoAction(
  token: string,
  path: string
): Promise<StepResult> {
  try {
    const profileId = await verifyOnboardingToken(token);
    if (!profileId) return { error: EXPIRED };

    if (isRateLimited(`onboard:finalise:${profileId}`, 30, HOUR_MS)) return { error: TOO_MANY };

    await finalisePhoto(profileId, String(path));
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Step three: send it for review. Refused unless at least one photo is attached. */
export async function completeOnboardingAction(token: string): Promise<StepResult> {
  try {
    const profileId = await verifyOnboardingToken(token);
    if (!profileId) return { error: EXPIRED };

    await submitDraft(profileId);

    // The admin's Approvals page and home card read this.
    revalidatePath("/admin");
    revalidatePath("/admin/approvals");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
