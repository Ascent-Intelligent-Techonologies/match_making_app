"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { profileSchema } from "@/lib/validation";
import { feetInchesToCm } from "@/lib/format";
import {
  createProfile,
  updateProfile,
  deleteProfile,
  softDeleteProfile,
  restoreProfile,
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

  // The form collects height as feet + inches; cm is what we store.
  const { height_feet, height_inches, ...rest } = raw;
  const heightCm = feetInchesToCm(Number(height_feet), Number(height_inches));

  return {
    ...rest,
    hobbies,
    height_cm: heightCm,
    // Unchecked boxes post nothing at all, so each one is read explicitly
    // rather than inferred from the spread above.
    is_active: formData.get("is_active") === "on",
    urgent: formData.get("urgent") === "on",
    sibling1_potential_client: formData.get("sibling1_potential_client") === "on",
    sibling2_potential_client: formData.get("sibling2_potential_client") === "on",
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

function revalidateProfileLists() {
  revalidatePath("/admin");
  revalidatePath("/admin/profiles");
  revalidatePath("/admin/deleted");
}

/** Moves a profile to the Deleted page. Reversible, and nothing is destroyed. */
export async function softDeleteProfileAction(profileId: string) {
  await softDeleteProfile(profileId);
  revalidateProfileLists();
  redirect("/admin/profiles");
}

export async function restoreProfileAction(profileId: string) {
  await restoreProfile(profileId);
  revalidateProfileLists();
}

/** Permanent: the row, its photos and every link and shortlist row go. */
export async function deleteProfileAction(profileId: string) {
  await deleteProfile(profileId);
  revalidateProfileLists();
  redirect("/admin/profiles");
}

/** Same, but called from the Deleted page, which stays where it is. */
export async function purgeProfileAction(profileId: string) {
  await deleteProfile(profileId);
  revalidateProfileLists();
}
