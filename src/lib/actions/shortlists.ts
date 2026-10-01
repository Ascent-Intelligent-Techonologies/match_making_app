"use server";

import { revalidatePath } from "next/cache";
import { getShareLinkByToken } from "@/lib/data/share-links";
import { toggleShortlist } from "@/lib/data/shortlists";

export interface ShortlistResult {
  shortlisted?: boolean;
  error?: string;
}

/**
 * Hearts/un-hearts a profile from the public share page.
 *
 * There is no login here — the unguessable token is the authorisation, so
 * everything is re-checked server-side: the link must still be live, and the
 * profile must actually belong to it.
 */
export async function toggleShortlistAction(
  token: string,
  profileId: string
): Promise<ShortlistResult> {
  const link = await getShareLinkByToken(token);

  if (!link || link.revoked || new Date(link.expires_at) < new Date()) {
    return { error: "This link is no longer active." };
  }
  if (!link.client_id) {
    return { error: "Shortlisting isn't available for this link." };
  }
  if (!link.profiles.some((p) => p.id === profileId)) {
    return { error: "That profile isn't part of this link." };
  }

  const shortlisted = await toggleShortlist({
    clientId: link.client_id,
    profileId,
    shareLinkId: link.id,
  });

  revalidatePath(`/share/${token}`);
  revalidatePath("/admin/clients");
  revalidatePath("/admin/analytics");

  return { shortlisted };
}
