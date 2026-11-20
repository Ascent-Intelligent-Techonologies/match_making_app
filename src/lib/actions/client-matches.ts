"use server";

import { revalidatePath } from "next/cache";
import { isAdminAuthenticated } from "@/lib/auth/session";
import {
  ClientMatchError,
  createClientMatch,
  deleteClientMatch,
} from "@/lib/data/client-matches";

/**
 * The Client match list on the Follow-up page.
 *
 * Returns a message instead of throwing: in production a thrown error reaches
 * the browser with its text removed, and "that pair is already on the list" is
 * something the admin needs to read.
 */

export interface ClientMatchState {
  error?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function addClientMatchAction(
  boyId: string,
  girlId: string,
  notes: string
): Promise<ClientMatchState> {
  if (!(await isAdminAuthenticated())) return { error: "Please sign in again." };
  // Arguments reach the server as typed by whoever called, so they are checked.
  if (!UUID.test(String(boyId)) || !UUID.test(String(girlId))) {
    return { error: "Pick a boy's profile and a girl's profile." };
  }

  try {
    await createClientMatch({ boyId, girlId, notes: String(notes ?? "") });
  } catch (error) {
    if (error instanceof ClientMatchError) return { error: error.message };
    console.error("Could not add a client match:", error);
    return { error: "Could not save that. Please try again." };
  }

  revalidatePath("/admin/followups");
  return {};
}

export async function deleteClientMatchAction(id: string): Promise<void> {
  if (!(await isAdminAuthenticated())) throw new Error("Please sign in again.");
  if (!UUID.test(String(id))) return;

  await deleteClientMatch(id);
  revalidatePath("/admin/followups");
}
