"use server";

import { revalidatePath } from "next/cache";
import { isAdminAuthenticated } from "@/lib/auth/session";
import { setProfileApproval } from "@/lib/data/profiles";
import { ensureClientForProfile } from "@/lib/data/clients";

/**
 * An admin's decision on a self-onboarded profile.
 *
 * These are what make a profile visible to clients, and an action is a public
 * POST endpoint in its own right (see the Next.js server-actions guide), so
 * each one checks the admin session itself rather than trusting that it was
 * only ever called from a page the proxy protects.
 *
 * They return a message instead of throwing: in production a thrown error
 * reaches the browser with its text removed, and "that profile has already
 * been dealt with" is something the admin needs to read.
 */

export interface DecisionResult {
  error?: string;
}

const SIGN_IN_AGAIN = "Please sign in again.";
const ALREADY_DECIDED =
  "That profile is no longer waiting for review. Reload the page to see where it is now.";

function revalidateAfterDecision(profileId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/approvals");
  revalidatePath("/admin/profiles");
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/profiles/${profileId}`);
}

/**
 * Makes the profile live: it appears in Search and All Profiles, and its
 * family is added to the client list (the same step every profile gets when an
 * admin saves it with a name and number).
 */
export async function approveProfileAction(profileId: string): Promise<DecisionResult> {
  if (!(await isAdminAuthenticated())) return { error: SIGN_IN_AGAIN };

  const profile = await setProfileApproval(profileId, "approved");
  if (!profile) return { error: ALREADY_DECIDED };

  try {
    await ensureClientForProfile(profile);
  } catch (error) {
    // Approved is approved: a client that could not be added can be added by hand.
    console.error("Approved a profile but could not add its client:", error);
  }
  revalidateAfterDecision(profileId);
  return {};
}

/** Declines it. It stays on the Approvals page, where it can still be approved later. */
export async function rejectProfileAction(profileId: string): Promise<DecisionResult> {
  if (!(await isAdminAuthenticated())) return { error: SIGN_IN_AGAIN };

  const profile = await setProfileApproval(profileId, "rejected");
  if (!profile) return { error: ALREADY_DECIDED };

  revalidateAfterDecision(profileId);
  return {};
}
