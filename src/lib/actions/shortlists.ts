"use server";

import { revalidatePath } from "next/cache";
import { getShareLinkByToken } from "@/lib/data/share-links";
import { toggleShortlist } from "@/lib/data/shortlists";
import { upsertClientByPhone } from "@/lib/data/clients";
import { getBrowsingClientId, setClientSessionCookie } from "@/lib/auth/client-session";
import { isUsablePhone } from "@/lib/phone";

export interface ShortlistResult {
  shortlisted?: boolean;
  error?: string;
  /** Set when the viewer must identify themselves before shortlisting. */
  needsIdentity?: boolean;
}

/**
 * Re-checks that a token still grants access to a profile. Everything here is
 * authorised by the unguessable token alone, so it is verified server-side on
 * every call rather than trusted from the page.
 */
async function resolveLink(token: string, profileId: string) {
  const link = await getShareLinkByToken(token);
  if (!link || link.revoked || new Date(link.expires_at) < new Date()) {
    return { error: "This link is no longer active." as const };
  }
  if (!link.profiles.some((p) => p.id === profileId)) {
    return { error: "That profile isn't part of this link." as const };
  }
  return { link };
}

/**
 * Hearts/un-hearts a profile from a share page.
 *
 * The person who opens a link is not necessarily the person it was sent to —
 * links get forwarded within a family — so a shortlist is only recorded once
 * the viewer has said who they are. Their identity is held in a signed cookie.
 */
export async function toggleShortlistAction(
  token: string,
  profileId: string
): Promise<ShortlistResult> {
  const resolved = await resolveLink(token, profileId);
  if ("error" in resolved) return { error: resolved.error };

  const viewerClientId = await getBrowsingClientId();
  if (!viewerClientId) return { needsIdentity: true };

  const shortlisted = await toggleShortlist({
    clientId: viewerClientId,
    profileId,
    shareLinkId: resolved.link.id,
  });

  revalidatePath(`/share/${token}`);
  revalidatePath("/admin/clients");
  revalidatePath("/admin/analytics");
  return { shortlisted };
}

/**
 * Captures who is viewing, then applies the shortlist they just asked for, so
 * the tap that prompted the question is not lost.
 *
 * Matching is by phone, so someone the admin already created a client record
 * for is recognised rather than duplicated.
 */
export async function identifyAndShortlistAction(
  token: string,
  profileId: string,
  fullName: string,
  phone: string
): Promise<ShortlistResult> {
  const name = fullName.trim();
  if (!name) return { error: "Please enter your name.", needsIdentity: true };
  if (!isUsablePhone(phone)) {
    return { error: "Please enter a valid phone number.", needsIdentity: true };
  }

  const resolved = await resolveLink(token, profileId);
  if ("error" in resolved) return { error: resolved.error };

  const client = await upsertClientByPhone({ fullName: name, phone });
  await setClientSessionCookie(client.id);

  const shortlisted = await toggleShortlist({
    clientId: client.id,
    profileId,
    shareLinkId: resolved.link.id,
  });

  revalidatePath(`/share/${token}`);
  revalidatePath("/admin/clients");
  revalidatePath("/admin/analytics");
  return { shortlisted };
}
