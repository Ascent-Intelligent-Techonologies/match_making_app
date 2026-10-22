"use server";

import { revalidatePath } from "next/cache";
import {
  beginPhotoUpload,
  deleteProfilePhoto,
  finalisePhotoUpload,
  reorderProfilePhotos,
  setCoverPhoto,
  updatePhotoFraming,
  type UploadTicket,
} from "@/lib/data/photos";
import { sanitizeFraming } from "@/lib/framing";
import type { ProfilePhoto } from "@/lib/types";

/**
 * Uploading is two calls from the browser with a direct PUT to Blob Storage
 * in between. Neither action ever sees the file's bytes, which is what lets
 * a batch of fifty HD photos go up without touching this server's request
 * limit or memory.
 */

export type UploadTicketResult = { ticket: UploadTicket } | { error: string };

/** Step one: a write-only URL for one file, to a path the server chooses. */
export async function requestPhotoUploadAction(
  profileId: string,
  file: { name: string; type: string; size: number }
): Promise<UploadTicketResult> {
  try {
    return { ticket: await beginPhotoUpload(profileId, file) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not start the upload." };
  }
}

export type FinaliseResult = { photo: ProfilePhoto } | { error: string };

/**
 * Step two, after the PUT: validate, make the resized copies, record it.
 * `framing` is what the admin chose in the framing step; anything missing or
 * malformed is stored as null, which is the automatic framing.
 */
export async function finalisePhotoUploadAction(
  profileId: string,
  path: string,
  framing?: unknown
): Promise<FinaliseResult> {
  try {
    const photo = await finalisePhotoUpload(profileId, path, sanitizeFraming(framing));
    revalidatePath(`/admin/profiles/${profileId}`);
    return { photo };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Upload failed." };
  }
}

export async function deletePhotoAction(profileId: string, photoId: string) {
  await deleteProfilePhoto(photoId);
  revalidatePath(`/admin/profiles/${profileId}`);
}

export async function reorderPhotosAction(profileId: string, orderedIds: string[]) {
  await reorderProfilePhotos(orderedIds);
  revalidatePath(`/admin/profiles/${profileId}`);
}

export async function setCoverPhotoAction(profileId: string, photoId: string) {
  await setCoverPhoto(profileId, photoId);
  revalidatePath(`/admin/profiles/${profileId}`);
}

/** Re-frames a photo already on the profile. */
export async function updatePhotoFramingAction(
  profileId: string,
  photoId: string,
  framing: unknown
): Promise<{ error?: string }> {
  const clean = sanitizeFraming(framing);
  if (!clean) return { error: "That framing is not valid." };
  await updatePhotoFraming(photoId, clean);
  revalidatePath(`/admin/profiles/${profileId}`);
  return {};
}
