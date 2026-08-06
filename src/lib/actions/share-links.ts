"use server";

import { revalidatePath } from "next/cache";
import { shareLinkSchema } from "@/lib/validation";
import {
  createShareLink,
  revokeShareLink,
  extendShareLink,
  updateShareLinkAccessLevel,
} from "@/lib/data/share-links";
import { updateDefaultExpiryDays } from "@/lib/data/settings";
import type { AccessLevel } from "@/lib/types";

export interface ShareLinkFormState {
  error?: string;
  createdUrl?: string;
}

export async function createShareLinkAction(
  _prevState: ShareLinkFormState,
  formData: FormData
): Promise<ShareLinkFormState> {
  const profileIds = formData.getAll("profileIds").map(String);
  const parsed = shareLinkSchema.safeParse({
    profileIds,
    accessLevel: formData.get("accessLevel"),
    expiryDays: formData.get("expiryDays"),
    label: formData.get("label") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const link = await createShareLink(parsed.data);
  revalidatePath("/owner/links");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return { createdUrl: `${siteUrl}/share/${link.token}` };
}

export async function revokeShareLinkAction(id: string) {
  await revokeShareLink(id);
  revalidatePath("/owner/links");
}

export async function extendShareLinkAction(id: string, additionalDays: number) {
  await extendShareLink(id, additionalDays);
  revalidatePath("/owner/links");
}

export async function updateAccessLevelAction(id: string, accessLevel: AccessLevel) {
  await updateShareLinkAccessLevel(id, accessLevel);
  revalidatePath("/owner/links");
}

export async function updateDefaultExpiryAction(formData: FormData) {
  const days = Number(formData.get("defaultExpiryDays"));
  if (Number.isFinite(days) && days > 0) {
    await updateDefaultExpiryDays(days);
  }
  revalidatePath("/owner/links");
}
