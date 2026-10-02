"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteClient, upsertClientByPhone } from "@/lib/data/clients";
import { removeShortlist } from "@/lib/data/shortlists";
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

/**
 * Removes a client, their shortlists, searches, follow-ups and the links we
 * sent them. There is no undo, so the button that calls this asks first.
 */
export async function deleteClientAction(clientId: string) {
  await deleteClient(clientId);
  revalidatePath("/admin/clients");
  revalidatePath("/admin/links");
  revalidatePath("/admin/analytics");
  redirect("/admin/clients");
}

/** Takes a profile off a client's shortlist from the admin side. */
export async function removeClientShortlistAction(clientId: string, profileId: string) {
  await removeShortlist(clientId, profileId);
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");
  revalidatePath("/admin/analytics");
}
