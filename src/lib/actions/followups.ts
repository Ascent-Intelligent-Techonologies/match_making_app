"use server";

import { revalidatePath } from "next/cache";
import { addFollowup, deleteFollowup } from "@/lib/data/followups";

export interface FollowupState {
  error?: string;
  savedAt?: number;
}

/** Logs a call or conversation against a client. */
export async function addFollowUpAction(
  clientId: string,
  _prevState: FollowupState,
  formData: FormData
): Promise<FollowupState> {
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { error: "Write a short note about the conversation." };

  await addFollowup({ clientId, note });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/analytics");
  return { savedAt: Date.now() };
}

/** Removes a logged note, for the ones typed into the wrong client. */
export async function deleteFollowUpAction(clientId: string, followupId: string) {
  await deleteFollowup(followupId);
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/analytics");
}
