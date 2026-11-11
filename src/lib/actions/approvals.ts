"use server";

import { revalidatePath } from "next/cache";
import { isAdminAuthenticated } from "@/lib/auth/session";
import { anyOf, selectOne } from "@/lib/db";
import { setProfileApproval } from "@/lib/data/profiles";
import { ensureClientForProfile, linkClientToProfile } from "@/lib/data/clients";
import {
  findApprovalMatches,
  hasMatches,
  mergeSubmissionInto,
  MergeStaleError,
} from "@/lib/data/duplicates";
import { resolveClientName, resolveMerge, type ApprovalDecision } from "@/lib/profile-merge";
import type { Profile } from "@/lib/types";

/**
 * An admin's decision on a self-onboarded profile.
 *
 * These are what make a profile visible to clients, and an action is a public
 * POST endpoint in its own right (see the Next.js server-actions guide), so
 * each one checks the admin session itself rather than trusting that it was
 * only ever called from a page the proxy protects. The page's view of the
 * matches is never trusted either: they are looked up again here, and a
 * decision naming a profile that is not a match is refused.
 *
 * They return a message instead of throwing: in production a thrown error
 * reaches the browser with its text removed, and "that profile has already
 * been dealt with" is something the admin needs to read.
 */

export interface DecisionResult {
  error?: string;
  /** Where the screen should go next, when the profile it was showing is gone. */
  goTo?: string;
}

const SIGN_IN_AGAIN = "Please sign in again.";
const ALREADY_DECIDED =
  "That profile is no longer waiting for review. Reload the page to see where it is now.";
const MATCH_CHANGED =
  "The profiles on file for this number have changed. Reload the page and try again.";

function revalidateAfterDecision(...profileIds: string[]) {
  revalidatePath("/admin");
  revalidatePath("/admin/approvals");
  revalidatePath("/admin/profiles");
  revalidatePath("/admin/clients");
  for (const id of profileIds) revalidatePath(`/admin/profiles/${id}`);
}

/** The sign-up, if it is still waiting (or was declined and is being reconsidered). */
async function loadWaiting(profileId: string): Promise<Profile | null> {
  return selectOne<Profile>("profiles", {
    where: {
      id: profileId,
      deleted_at: null,
      approval_status: anyOf(["pending", "rejected"]),
    },
  });
}

/**
 * Approves a sign-up whose number is not on file anywhere: it becomes live,
 * and its family is added to the client list.
 *
 * A number that is already on a profile or a client is refused here, whatever
 * the page showed: that choice goes through approveWithResolutionAction.
 */
export async function approveProfileAction(profileId: string): Promise<DecisionResult> {
  if (!(await isAdminAuthenticated())) return { error: SIGN_IN_AGAIN };

  const waiting = await loadWaiting(profileId);
  if (!waiting) return { error: ALREADY_DECIDED };
  if (hasMatches(await findApprovalMatches(waiting))) {
    return {
      error:
        "This number is already on a client or a profile. Open the profile to choose how to approve it.",
    };
  }

  const profile = await setProfileApproval(profileId, "approved");
  if (!profile) return { error: ALREADY_DECIDED };

  await addClientFor(profile);
  revalidateAfterDecision(profileId);
  return {};
}

/** Adds the family to the client list; approved is approved even if this fails. */
async function addClientFor(profile: Profile) {
  try {
    await ensureClientForProfile(profile);
  } catch (error) {
    console.error("Approved a profile but could not add its client:", error);
  }
}

/**
 * Approves a sign-up whose number is already a client or on a profile, the way
 * the admin chose (see ApprovalDecision).
 */
export async function approveWithResolutionAction(
  profileId: string,
  decision: ApprovalDecision
): Promise<DecisionResult> {
  if (!(await isAdminAuthenticated())) return { error: SIGN_IN_AGAIN };

  const waiting = await loadWaiting(profileId);
  if (!waiting) return { error: ALREADY_DECIDED };
  const matches = await findApprovalMatches(waiting);

  if (decision?.mode === "merge") {
    const target = matches.profiles.find((p) => p.id === decision.targetId);
    if (!target) return { error: MATCH_CHANGED };

    const resolved = resolveMerge(target, waiting, decision.fields ?? {});
    if ("error" in resolved) return { error: resolved.error };

    try {
      await mergeSubmissionInto(target.id, waiting.id, resolved.changes);
    } catch (error) {
      if (error instanceof MergeStaleError) return { error: ALREADY_DECIDED };
      throw error;
    }

    // Already a client in nearly every case, so this usually adds nothing.
    await addClientFor({ ...target, ...resolved.changes } as Profile);
    revalidateAfterDecision(waiting.id, target.id);
    return { goTo: `/admin/profiles/${target.id}` };
  }

  if (decision?.mode === "separate") {
    // Linking only makes sense for a client who has no profile of their own.
    const link = decision.linkClient && matches.client && matches.clientIsStandalone;
    let clientName = "";
    if (link && matches.client) {
      const named = resolveClientName(
        decision.linkClient,
        matches.client.full_name,
        [waiting.full_name, waiting.surname].filter(Boolean).join(" ")
      );
      if ("error" in named) return { error: named.error };
      clientName = named.name;
    }

    const profile = await setProfileApproval(profileId, "approved");
    if (!profile) return { error: ALREADY_DECIDED };

    let linked = false;
    if (link && matches.client) {
      try {
        linked = await linkClientToProfile(matches.client.id, profile.id, clientName);
      } catch (error) {
        console.error("Approved a profile but could not link its client:", error);
      }
    }
    if (!linked) await addClientFor(profile);

    revalidateAfterDecision(profileId);
    return {};
  }

  return { error: "Please choose how to approve this profile." };
}

/** Declines it. It stays on the Approvals page, where it can still be approved later. */
export async function rejectProfileAction(profileId: string): Promise<DecisionResult> {
  if (!(await isAdminAuthenticated())) return { error: SIGN_IN_AGAIN };

  const profile = await setProfileApproval(profileId, "rejected");
  if (!profile) return { error: ALREADY_DECIDED };

  revalidateAfterDecision(profileId);
  return {};
}
