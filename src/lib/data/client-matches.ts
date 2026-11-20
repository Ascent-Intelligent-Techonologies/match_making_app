import "server-only";
import { deleteMany, insertOne, query, selectMany } from "@/lib/db";
import {
  GENDER_FOR_SIDE,
  MAX_MATCH_NOTES_LENGTH,
  type MatchProfile,
  type MatchSide,
} from "@/lib/client-match";

/** An error whose message is meant for the admin who caused it. */
export class ClientMatchError extends Error {}

export interface ClientMatchRow {
  id: string;
  created_at: string;
  notes: string | null;
  boy: MatchProfile & { deleted_at: string | null };
  girl: MatchProfile & { deleted_at: string | null };
}

/** A profile folded into one JSON column, so a pair comes back as one row. */
const profileJson = (alias: string) => `jsonb_build_object(
  'id', ${alias}.id,
  'full_name', ${alias}.full_name,
  'surname', ${alias}.surname,
  'dob', ${alias}.dob,
  'city', ${alias}.city,
  'gender', ${alias}.gender,
  'deleted_at', ${alias}.deleted_at
)`;

/** Every pair in communication, newest first. */
export async function listClientMatches(): Promise<ClientMatchRow[]> {
  // The two joins and the folded JSON are beyond what a generic select
  // assembles, so the shape is written out here.
  return selectMany<ClientMatchRow>("client_matches", {
    from: "client_matches m",
    joins: `join profiles b on b.id = m.boy_profile_id
            join profiles g on g.id = m.girl_profile_id`,
    columns: `m.id, m.created_at, m.notes,
              ${profileJson("b")} as boy,
              ${profileJson("g")} as girl`,
    orderBy: "m.created_at desc, m.id",
  });
}

/** How many candidates a picker shows before asking for more typing. */
export const MATCH_PICKER_LIMIT = 30;

/**
 * Live profiles matching what was typed in a picker, by name or by phone
 * number, names that start with it first.
 *
 * Only profiles of the right side are offered, plus any with no gender set
 * (the public sign-up leaves it optional, and otherwise those people could not
 * be put on a pair at all). Profiles awaiting approval are never offered.
 */
export async function searchMatchCandidates(
  text: string,
  side: MatchSide
): Promise<{ profiles: MatchProfile[]; more: boolean }> {
  const term = text.trim().slice(0, 100);
  const digits = term.replace(/\D/g, "");

  const rows = await query<MatchProfile>(
    `select id, full_name, surname, dob, city, gender
       from profiles
      where deleted_at is null
        and approval_status = 'approved'
        and is_active
        and (gender = $1 or gender is null)
        and ($2 = ''
             or concat_ws(' ', full_name, surname) ilike '%' || $3 || '%'
             or ($4 <> '' and right(regexp_replace(coalesce(contact_phone, ''), '\\D', '', 'g'), 10)
                              like '%' || $4 || '%'))
      order by (concat_ws(' ', full_name, surname) ilike $3 || '%') desc, full_name, id
      limit ${MATCH_PICKER_LIMIT + 1}`,
    [
      GENDER_FOR_SIDE[side],
      term,
      // % and _ typed by the admin mean themselves, not "anything".
      term.replace(/[\\%_]/g, "\\$&"),
      // A few digits are enough to look someone up by number; fewer match everyone.
      digits.length >= 3 ? digits : "",
    ]
  );
  return {
    profiles: rows.slice(0, MATCH_PICKER_LIMIT),
    more: rows.length > MATCH_PICKER_LIMIT,
  };
}

/**
 * Adds a pair to the list. Both profiles are checked again here, whatever the
 * picker offered: they must be live, approved, on the right sides, and not
 * already listed together.
 */
export async function createClientMatch(input: {
  boyId: string;
  girlId: string;
  notes: string;
}): Promise<void> {
  if (input.boyId === input.girlId) {
    throw new ClientMatchError("Pick two different profiles.");
  }
  const notes = input.notes.trim();
  if (notes.length > MAX_MATCH_NOTES_LENGTH) {
    throw new ClientMatchError("The notes are too long.");
  }

  const found = await query<{ id: string; gender: "male" | "female" | null }>(
    `select id, gender from profiles
      where id = any($1::uuid[]) and deleted_at is null and approval_status = 'approved'`,
    [[input.boyId, input.girlId]]
  );
  const boy = found.find((p) => p.id === input.boyId);
  const girl = found.find((p) => p.id === input.girlId);
  if (!boy || !girl) {
    throw new ClientMatchError("One of those profiles is no longer available. Pick again.");
  }
  if (boy.gender === "female") {
    throw new ClientMatchError("That profile is marked as a girl. Pick a boy's profile.");
  }
  if (girl.gender === "male") {
    throw new ClientMatchError("That profile is marked as a boy. Pick a girl's profile.");
  }

  try {
    await insertOne("client_matches", {
      boy_profile_id: input.boyId,
      girl_profile_id: input.girlId,
      notes: notes || null,
    });
  } catch (error) {
    // 23505 is a unique violation: the same pair is already on the list.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      throw new ClientMatchError("That pair is already on the list.");
    }
    throw error;
  }
}

export async function deleteClientMatch(id: string): Promise<void> {
  await deleteMany("client_matches", { id });
}
