"use server";

import { revalidatePath } from "next/cache";
import { upsertClientByPhone, touchClientActivity } from "@/lib/data/clients";
import { recordClientSearch } from "@/lib/data/searches";
import { toggleShortlist, getShortlistedProfileIds } from "@/lib/data/shortlists";
import { setClientSessionCookie, getBrowsingClientId } from "@/lib/auth/client-session";
import { isUsablePhone } from "@/lib/phone";

export interface BrowseGateState {
  error?: string;
}

/**
 * Identifies the visitor before they browse, so their filters and likes are
 * attributed to a client rather than floating free.
 */
export async function startBrowsingAction(
  _prevState: BrowseGateState,
  formData: FormData
): Promise<BrowseGateState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!fullName) return { error: "Please enter your name." };
  if (!isUsablePhone(phone)) {
    return { error: "Please enter a valid phone number (at least 10 digits)." };
  }

  const client = await upsertClientByPhone({ fullName, phone });
  await setClientSessionCookie(client.id);
  await touchClientActivity(client.id);

  revalidatePath("/browse");
  revalidatePath("/admin/clients");
  return {};
}

/** Logs a filter set the browsing client applied. Fire-and-forget from the page. */
export async function recordBrowseSearchAction(
  filters: Record<string, string>,
  resultCount: number
): Promise<void> {
  const clientId = await getBrowsingClientId();
  if (!clientId) return;

  try {
    await recordClientSearch({ clientId, filters, resultCount });
    await touchClientActivity(clientId);
  } catch {
    // Logging a search is telemetry; never let it break browsing.
  }
}

export interface BrowseShortlistResult {
  shortlisted?: boolean;
  error?: string;
}

/** Hearts a profile from the public browse pages, keyed by the browse cookie. */
export async function toggleBrowseShortlistAction(
  profileId: string
): Promise<BrowseShortlistResult> {
  const clientId = await getBrowsingClientId();
  if (!clientId) return { error: "Please enter your details before shortlisting." };

  const shortlisted = await toggleShortlist({ clientId, profileId, shareLinkId: null });

  revalidatePath("/browse");
  revalidatePath("/admin/clients");
  revalidatePath("/admin/analytics");
  return { shortlisted };
}

/** Profile ids the current browsing client has already hearted. */
export async function getBrowseShortlistedIds(): Promise<string[]> {
  const clientId = await getBrowsingClientId();
  if (!clientId) return [];
  return getShortlistedProfileIds(clientId);
}
