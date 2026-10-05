"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  deleteClient,
  restoreClient,
  softDeleteClient,
  upsertClientByPhone,
} from "@/lib/data/clients";
import { removeShortlist, toggleShortlistForAdmin } from "@/lib/data/shortlists";
import { isUsablePhone } from "@/lib/phone";

export interface ClientFormState {
  error?: string;
}

/** Creates (or re-uses) a client and starts searching on their behalf. */
export async function startSearchForClientAction(
  _prevState: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!fullName) return { error: "Enter the client's name." };
  if (!isUsablePhone(phone)) return { error: "Enter a valid phone number (at least 10 digits)." };

  const client = await upsertClientByPhone({ fullName, phone });
  revalidatePath("/admin/clients");

  redirect(`/admin/search?client=${client.id}`);
}

function revalidateClientLists() {
  revalidatePath("/admin/clients");
  revalidatePath("/admin/links");
  revalidatePath("/admin/analytics");
  revalidatePath("/admin/deleted");
}

/** Moves a client to the Deleted page. Their links keep working until purged. */
export async function softDeleteClientAction(clientId: string) {
  await softDeleteClient(clientId);
  revalidateClientLists();
  redirect("/admin/clients");
}

/** Same, from a list that should stay put rather than redirect. */
export async function softDeleteClientInPlaceAction(clientId: string) {
  await softDeleteClient(clientId);
  revalidateClientLists();
}

export async function restoreClientAction(clientId: string) {
  await restoreClient(clientId);
  revalidateClientLists();
}

/**
 * Permanent. Removes the client, their shortlists, searches, follow-ups and
 * the links we sent them. There is no undo, so the button that calls this
 * asks first.
 */
export async function deleteClientAction(clientId: string) {
  await deleteClient(clientId);
  revalidateClientLists();
  redirect("/admin/clients");
}

/** Same, but called from the Deleted page, which stays where it is. */
export async function purgeClientAction(clientId: string) {
  await deleteClient(clientId);
  revalidateClientLists();
}

/** Shortlists or un-shortlists a profile for a client, from the admin side. */
export async function toggleClientShortlistAction(
  clientId: string,
  profileId: string
): Promise<{ shortlisted?: boolean; error?: string }> {
  try {
    const shortlisted = await toggleShortlistForAdmin(clientId, profileId);
    revalidatePath("/admin/search");
    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath("/admin/analytics");
    return { shortlisted };
  } catch {
    return { error: "Could not update the shortlist." };
  }
}

/** Takes a profile off a client's shortlist from the admin side. */
export async function removeClientShortlistAction(clientId: string, profileId: string) {
  await removeShortlist(clientId, profileId);
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");
  revalidatePath("/admin/analytics");
}
