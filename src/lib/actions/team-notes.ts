"use server";

import { revalidatePath } from "next/cache";
import { saveTeamNote } from "@/lib/data/team-notes";
import { TEAM_MEMBERS } from "@/lib/constants";

export interface TeamNoteState {
  error?: string;
  savedAt?: number;
}

export async function saveTeamNoteAction(
  slug: string,
  _prev: TeamNoteState,
  formData: FormData
): Promise<TeamNoteState> {
  // The slug comes from the page, but it reaches the server as an argument, so
  // it is checked against the known consultants rather than trusted.
  if (!TEAM_MEMBERS.some((m) => m.slug === slug)) {
    return { error: "Unknown consultant." };
  }

  await saveTeamNote(slug, String(formData.get("body") ?? ""));
  revalidatePath("/admin/followups");
  return { savedAt: Date.now() };
}
