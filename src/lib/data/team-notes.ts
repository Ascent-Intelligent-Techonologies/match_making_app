import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { TEAM_MEMBERS } from "@/lib/constants";
import type { TeamNote } from "@/lib/types";

/**
 * One running note per consultant, kept as plain text rather than a list of
 * rows: these are scratch bullet points that get rewritten constantly, and a
 * textarea the whole block is saved from matches how they are actually used.
 */
export async function listTeamNotes(): Promise<TeamNote[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("team_notes").select("*");
  if (error) throw error;

  const bySlug = new Map((data ?? []).map((n: TeamNote) => [n.slug, n]));
  // Ordered by TEAM_MEMBERS, and complete even before anyone has saved.
  return TEAM_MEMBERS.map(
    ({ slug }) =>
      bySlug.get(slug) ?? { slug, body: "", updated_at: new Date(0).toISOString() }
  );
}

export async function saveTeamNote(slug: string, body: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("team_notes")
    .upsert({ slug, body, updated_at: new Date().toISOString() }, { onConflict: "slug" });
  if (error) throw error;
}
