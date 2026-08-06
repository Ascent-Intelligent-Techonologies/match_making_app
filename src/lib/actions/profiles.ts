"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { profileSchema } from "@/lib/validation";
import {
  createProfile,
  updateProfile,
  deleteProfile,
} from "@/lib/data/profiles";

export interface ProfileFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

function parseProfileFormData(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const hobbies = String(raw.hobbies ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  return {
    ...raw,
    hobbies,
    is_active: formData.get("is_active") === "on",
  };
}

export async function createProfileAction(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const parsed = profileSchema.safeParse(parseProfileFormData(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
    };
  }

  const profile = await createProfile(parsed.data);
  revalidatePath("/owner");
  redirect(`/owner/profiles/${profile.id}`);
}

export async function updateProfileAction(
  profileId: string,
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const parsed = profileSchema.safeParse(parseProfileFormData(formData));
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string>,
    };
  }

  await updateProfile(profileId, parsed.data);
  revalidatePath("/owner");
  revalidatePath(`/owner/profiles/${profileId}`);
  return { error: undefined };
}

export async function deleteProfileAction(profileId: string) {
  await deleteProfile(profileId);
  revalidatePath("/owner");
  redirect("/owner");
}
