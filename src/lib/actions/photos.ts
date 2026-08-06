"use server";

import { revalidatePath } from "next/cache";
import {
  uploadProfilePhoto,
  deleteProfilePhoto,
  reorderProfilePhotos,
  setCoverPhoto,
} from "@/lib/data/photos";

export interface PhotoActionState {
  error?: string;
}

export async function uploadPhotosAction(
  profileId: string,
  _prevState: PhotoActionState,
  formData: FormData
): Promise<PhotoActionState> {
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return { error: "Please choose at least one photo." };
  }

  try {
    for (const file of files) {
      await uploadProfilePhoto(profileId, file);
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed." };
  }

  revalidatePath(`/owner/profiles/${profileId}`);
  return {};
}

export async function deletePhotoAction(profileId: string, photoId: string) {
  await deleteProfilePhoto(photoId);
  revalidatePath(`/owner/profiles/${profileId}`);
}

export async function reorderPhotosAction(profileId: string, orderedIds: string[]) {
  await reorderProfilePhotos(orderedIds);
  revalidatePath(`/owner/profiles/${profileId}`);
}

export async function setCoverPhotoAction(profileId: string, photoId: string) {
  await setCoverPhoto(profileId, photoId);
  revalidatePath(`/owner/profiles/${profileId}`);
}
