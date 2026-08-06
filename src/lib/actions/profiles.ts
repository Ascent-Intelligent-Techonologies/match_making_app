"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { profileSchema } from "@/lib/validation";
import {
  createProfile,
  updateProfile,
  deleteProfile,
} from "@/lib/data/profiles";
import { uploadProfilePhoto } from "@/lib/data/photos";

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

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  for (const photo of photos) {
    try {
      await uploadProfilePhoto(profile.id, photo);
    } catch {
      // Profile is already saved; skip a bad photo rather than losing the profile data.
    }
  }

  revalidatePath("/admin");
  redirect(`/admin/profiles/${profile.id}`);
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
  revalidatePath("/admin");
  revalidatePath(`/admin/profiles/${profileId}`);
  return { error: undefined };
}

export async function deleteProfileAction(profileId: string) {
  await deleteProfile(profileId);
  revalidatePath("/admin");
  redirect("/admin");
}
