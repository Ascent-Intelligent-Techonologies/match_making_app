"use server";

import { revalidatePath } from "next/cache";
import { deleteJourneyMedia, uploadJourneyMedia } from "@/lib/data/journey";

export interface JourneyUploadState {
  error?: string;
  uploadedAt?: number;
  count?: number;
}

export async function uploadJourneyMediaAction(
  _prev: JourneyUploadState,
  formData: FormData
): Promise<JourneyUploadState> {
  const files = formData
    .getAll("media")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose at least one photo or video." };

  const caption = String(formData.get("caption") ?? "");

  let uploaded = 0;
  for (const file of files) {
    try {
      await uploadJourneyMedia(file, caption);
      uploaded++;
    } catch {
      // One bad file should not throw away the ones that did upload.
    }
  }

  revalidatePath("/admin/journey");
  if (uploaded === 0) return { error: "Nothing could be uploaded. Check the file types." };
  return { uploadedAt: Date.now(), count: uploaded };
}

export async function deleteJourneyMediaAction(id: string) {
  await deleteJourneyMedia(id);
  revalidatePath("/admin/journey");
}
