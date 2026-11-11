import "server-only";
import { query, selectOne, transaction } from "@/lib/db";
import { findClientSummaryByPhone } from "@/lib/data/clients";
import { normalizePhone } from "@/lib/phone";
import { diffProfiles, MERGE_FIELD_KEYS, type ResolverData } from "@/lib/profile-merge";
import type { ClientSummary, Profile } from "@/lib/types";

/**
 * A sign-up whose number is already on the books.
 *
 * Phone numbers are shared on purpose here (a parent registers two children
 * under one number), so a match is a prompt for the admin to decide, never
 * something the app settles for them.
 */

export interface ApprovalMatches {
  /** Live profiles with this number, or that belong to the client who holds it. */
  profiles: Profile[];
  /** The client holding this number. */
  client: ClientSummary | null;
  /** That client is not the client of any profile in `profiles`. */
  clientIsStandalone: boolean;
}

export const NO_MATCHES: ApprovalMatches = { profiles: [], client: null, clientIsStandalone: false };

export function hasMatches(matches: ApprovalMatches): boolean {
  return matches.profiles.length > 0 || matches.client !== null;
}

export async function findApprovalMatches(
  profile: Pick<Profile, "id" | "contact_phone">
): Promise<ApprovalMatches> {
  const digits = normalizePhone(profile.contact_phone ?? "");
  if (digits.length < 10) return NO_MATCHES;

  const [sameNumber, client] = await Promise.all([
    // Compared the way clients are keyed: digits only, last ten.
    query<Profile>(
      `select *
         from profiles
        where deleted_at is null
          and approval_status = 'approved'
          and id <> $1
          and right(regexp_replace(coalesce(contact_phone, ''), '\\D', '', 'g'), 10) = $2
        order by created_at
        limit 5`,
      [profile.id, digits]
    ),
    findClientSummaryByPhone(digits),
  ]);

  let profiles = sameNumber;

  // The client who holds this number may belong to a profile that has a
  // different number written on it (it was edited later): still a match.
  if (client?.profile_id && !profiles.some((p) => p.id === client.profile_id)) {
    const linked = await selectOne<Profile>("profiles", {
      where: { id: client.profile_id, deleted_at: null, approval_status: "approved" },
    });
    if (linked && linked.id !== profile.id) profiles = [...profiles, linked];
  }

  return {
    profiles,
    client,
    clientIsStandalone: client !== null && !profiles.some((p) => p.id === client.profile_id),
  };
}

const fullName = (p: Pick<Profile, "full_name" | "surname">) =>
  [p.full_name, p.surname].filter(Boolean).join(" ");

function clientSummaryLine(client: ClientSummary): string {
  const parts: string[] = [];
  if (client.sharedProfileCount > 0) {
    parts.push(`${client.sharedProfileCount} profile${client.sharedProfileCount === 1 ? "" : "s"} shared`);
  }
  if (client.shortlistedCount > 0) parts.push(`${client.shortlistedCount} shortlisted`);
  return parts.length > 0 ? parts.join(", ") : "nothing shared with them yet";
}

/** Everything the approval screen needs to show the match and offer the choices. */
export function describeMatches(submission: Profile, matches: ApprovalMatches): ResolverData {
  return {
    profileId: submission.id,
    submittedName: fullName(submission),
    client: matches.client
      ? {
          id: matches.client.id,
          name: matches.client.full_name,
          summary: clientSummaryLine(matches.client),
          standalone: matches.clientIsStandalone,
        }
      : null,
    profiles: matches.profiles.map((p) => ({
      id: p.id,
      name: fullName(p),
      diffs: diffProfiles(p, submission),
    })),
  };
}

/** Thrown when the sign-up or the profile it was to merge into is no longer as it was shown. */
export class MergeStaleError extends Error {}

/**
 * Folds a sign-up into a profile that is already live: writes the agreed
 * answers on it, moves the sign-up's photos across (after the ones it already
 * has), and removes the sign-up. All or nothing, so a failure part-way cannot
 * leave photos on a profile that is about to be deleted, or none on either.
 *
 * `changes` holds only columns of the public form (MERGE_FIELD_KEYS), already
 * settled by resolveMerge; anything else is refused here too, so this can
 * never write an internal field.
 */
export async function mergeSubmissionInto(
  targetId: string,
  submissionId: string,
  changes: Record<string, unknown>
): Promise<void> {
  const columns = Object.keys(changes);
  const allowed = new Set<string>(MERGE_FIELD_KEYS);
  const unexpected = columns.find((c) => !allowed.has(c));
  if (unexpected) throw new Error(`Refusing to merge into column ${unexpected}`);

  await transaction(async (run) => {
    // Locked, so two admins approving the same sign-up cannot both merge it.
    const waiting = await run(
      `select id from profiles
        where id = $1 and self_onboarded and approval_status in ('pending', 'rejected')
          and deleted_at is null
        for update`,
      [submissionId]
    );
    const live = await run(
      `select id from profiles
        where id = $1 and approval_status = 'approved' and deleted_at is null
        for update`,
      [targetId]
    );
    if (waiting.length === 0 || live.length === 0) throw new MergeStaleError();

    if (columns.length > 0) {
      const assignments = columns.map((column, i) => `${column} = $${i + 2}`).join(", ");
      await run(`update profiles set ${assignments}, updated_at = now() where id = $1`, [
        targetId,
        ...columns.map((column) => changes[column]),
      ]);
    }

    const [{ count }] = (await run(
      "select count(*)::int as count from profile_photos where profile_id = $1",
      [targetId]
    )) as { count: number }[];

    // After the profile's own photos, and none of them the cover: the cover is
    // a choice the admin already made.
    await run(
      `update profile_photos
          set profile_id = $1, sort_order = sort_order + $3, is_cover = false
        where profile_id = $2`,
      [targetId, submissionId, count]
    );
    // Unless the profile had no photos at all, in which case it needs a cover.
    await run(
      `update profile_photos set is_cover = true
        where id = (select id from profile_photos where profile_id = $1
                     order by sort_order, created_at limit 1)
          and not exists (select 1 from profile_photos where profile_id = $1 and is_cover)`,
      [targetId]
    );

    // Its photos have moved, so nothing in storage goes with it.
    await run("delete from profiles where id = $1", [submissionId]);
  });
}
