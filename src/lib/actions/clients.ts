"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { upsertClientByPhone } from "@/lib/data/clients";
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
