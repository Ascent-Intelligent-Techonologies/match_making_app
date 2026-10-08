"use server";

import { revalidatePath } from "next/cache";
import { shareLinkSchema } from "@/lib/validation";
import {
  createShareLink,
  deleteShareLink,
  revokeShareLink,
  restoreShareLink,
  updateShareLinkAccessLevel,
  updateShareLinkNotes,
} from "@/lib/data/share-links";
import { upsertClientByPhone } from "@/lib/data/clients";
import type { AccessLevel } from "@/lib/types";

export interface ShareLinkFormState {
  error?: string;
  createdUrl?: string;
  /** Echoed back so the share message can greet the client by name. */
  clientName?: string;
}

export async function createShareLinkAction(
  _prevState: ShareLinkFormState,
  formData: FormData
): Promise<ShareLinkFormState> {
  const profileIds = formData.getAll("profileIds").map(String);
  const parsed = shareLinkSchema.safeParse({
    profileIds,
    accessLevel: formData.get("accessLevel"),
    label: formData.get("label") ?? undefined,
    notes: formData.get("notes") ?? undefined,
    clientName: formData.get("clientName"),
    clientPhone: formData.get("clientPhone"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // If the admin named the client, the link is attributed to them and the
  // recipient is never asked. Otherwise client_id stays null and whoever opens
  // the link identifies themselves before they can shortlist.
  const client =
    parsed.data.clientName && parsed.data.clientPhone
      ? await upsertClientByPhone({
          fullName: parsed.data.clientName,
          phone: parsed.data.clientPhone,
        })
      : null;

  const link = await createShareLink({ ...parsed.data, clientId: client?.id ?? null });
  revalidatePath("/admin/links");
  revalidatePath("/admin/clients");
  revalidatePath("/admin/analytics");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return {
    createdUrl: `${siteUrl}/share/${link.token}`,
    clientName: client?.full_name,
  };
}

export async function revokeShareLinkAction(id: string) {
  await revokeShareLink(id);
  revalidatePath("/admin/links");
}

/**
 * Deletes a link rather than revoking it. Revoking keeps the row so the link
 * stays visible as "revoked"; deleting is for links sent in error, which are
 * better gone than listed forever.
 */
export async function deleteShareLinkAction(id: string) {
  await deleteShareLink(id);
  revalidatePath("/admin/links");
  revalidatePath("/admin/clients");
  revalidatePath("/admin/analytics");
}

export async function restoreShareLinkAction(id: string) {
  await restoreShareLink(id);
  revalidatePath("/admin/links");
}

/** The note is visible to the family, so it has to be correctable later. */
export async function updateShareLinkNotesAction(id: string, formData: FormData) {
  await updateShareLinkNotes(id, String(formData.get("notes") ?? ""));
  revalidatePath("/admin/links");
  revalidatePath("/admin/clients");
}

export async function updateAccessLevelAction(id: string, accessLevel: AccessLevel) {
  await updateShareLinkAccessLevel(id, accessLevel);
  revalidatePath("/admin/links");
}
