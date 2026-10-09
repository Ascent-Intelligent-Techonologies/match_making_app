import "server-only";
import { selectMany, upsertOne } from "@/lib/db";
import { TEAM_MEMBERS } from "@/lib/constants";
import type { TeamNote } from "@/lib/types";

/**
 * One running note per consultant, kept as plain text rather than a list of
 * rows: these are scratch bullet points that get rewritten constantly, and a
 * textarea the whole block is saved from matches how they are actually used.
 */
export async function listTeamNotes(): Promise<TeamNote[]> {
  const rows = await selectMany<TeamNote>("team_notes");
  const bySlug = new Map(rows.map((n) => [n.slug, n]));

  // Ordered by TEAM_MEMBERS, and complete even before anyone has saved.
  return TEAM_MEMBERS.map(
    ({ slug }) =>
      bySlug.get(slug) ?? { slug, body: "", updated_at: new Date(0).toISOString() }
  );
}

export async function saveTeamNote(slug: string, body: string): Promise<void> {
  await upsertOne("team_notes", { slug, body }, "slug", { updated_at: "now()" });
}
