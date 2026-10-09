import "server-only";
import { execute, query } from "@/lib/db";
import { TEAM_MEMBERS } from "@/lib/constants";
import type { TeamNote } from "@/lib/types";

/**
 * One running note per consultant, kept as plain text rather than a list of
 * rows: these are scratch bullet points that get rewritten constantly, and a
 * textarea the whole block is saved from matches how they are actually used.
 */
export async function listTeamNotes(): Promise<TeamNote[]> {
  const rows = await query<TeamNote>("select * from team_notes");

  const bySlug = new Map(rows.map((n) => [n.slug, n]));
  // Ordered by TEAM_MEMBERS, and complete even before anyone has saved.
  return TEAM_MEMBERS.map(
    ({ slug }) =>
      bySlug.get(slug) ?? { slug, body: "", updated_at: new Date(0).toISOString() }
  );
}

export async function saveTeamNote(slug: string, body: string): Promise<void> {
  await execute(
    `insert into team_notes (slug, body, updated_at)
     values ($1, $2, now())
     on conflict (slug) do update set body = excluded.body, updated_at = excluded.updated_at`,
    [slug, body]
  );
}
