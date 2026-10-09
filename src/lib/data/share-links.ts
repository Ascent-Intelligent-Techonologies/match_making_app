import "server-only";
import {
  deleteMany,
  execute,
  insertOne,
  selectMany,
  selectOne,
  updateMany,
  type SelectOptions,
} from "@/lib/db";
import { generateShareToken } from "@/lib/tokens";
import { touchClientActivity } from "@/lib/data/clients";
import type { AccessLevel, ShareLink, ShareLinkWithProfiles } from "@/lib/types";

/**
 * A link with its profiles and its client, in one round trip.
 *
 * The profiles come back as a JSON array built in the database rather than as
 * a join that repeats the link's columns once per profile — the shape the
 * callers already expect, without any stitching here. Beyond what a generic
 * select can assemble, so the shape is written out once and reused.
 */
const LINK_QUERY: SelectOptions = {
  from: "share_links l",
  joins: "left join clients c on c.id = l.client_id",
  columns: `l.*,
            coalesce((
              select jsonb_agg(
                       jsonb_build_object('id', p.id, 'full_name', p.full_name, 'city', p.city)
                       order by p.full_name
                     )
                from share_link_profiles slp
                join profiles p on p.id = slp.profile_id
               where slp.share_link_id = l.id
            ), '[]'::jsonb) as profiles,
            case when c.id is null then null
                 else jsonb_build_object(
                   'id', c.id,
                   'full_name', c.full_name,
                   'phone_display', c.phone_display
                 )
            end as client`,
  orderBy: "l.created_at desc",
};

export interface CreateShareLinkInput {
  profileIds: string[];
  accessLevel: AccessLevel;
  label?: string;
  /** Shown to the family on the share page itself, not just to the admin. */
  notes?: string;
  clientId: string | null;
}

/**
 * Creates a link that stays live until it is revoked or deleted. Links used
 * to expire after a few days, which mostly meant families losing access to
 * profiles they were still considering.
 */
export async function createShareLink(input: CreateShareLinkInput): Promise<ShareLink> {
  const link = await insertOne<ShareLink>("share_links", {
    token: generateShareToken(),
    label: input.label || null,
    notes: input.notes || null,
    access_level: input.accessLevel,
    client_id: input.clientId,
  });

  // One statement for the join rows: `unnest` expands the id array into a row
  // each, which a per-row insert loop would otherwise do one round trip at a
  // time.
  await execute(
    `insert into share_link_profiles (share_link_id, profile_id)
     select $1, unnest($2::uuid[])`,
    [link.id, input.profileIds]
  );

  return link;
}

export async function listShareLinks(): Promise<ShareLinkWithProfiles[]> {
  return selectMany<ShareLinkWithProfiles>("share_links", LINK_QUERY);
}

export async function listShareLinksForClient(clientId: string): Promise<ShareLinkWithProfiles[]> {
  return selectMany<ShareLinkWithProfiles>("share_links", {
    ...LINK_QUERY,
    where: { "l.client_id": clientId },
  });
}

export async function getShareLinkByToken(
  token: string
): Promise<ShareLinkWithProfiles | null> {
  return selectOne<ShareLinkWithProfiles>("share_links", {
    ...LINK_QUERY,
    where: { "l.token": token },
  });
}

/**
 * Marks a link as opened. Called when the client loads the share page, and is
 * what the "has this client responded?" analytics read from.
 */
export async function recordShareLinkView(
  linkId: string,
  clientId: string | null
): Promise<void> {
  // The count is incremented in the statement rather than read and written
  // back, so two families opening the same link at once can't lose a view.
  // Written as SQL because the count has to increment in place: reading it
  // and writing it back loses a view when two families open the same link at
  // the same moment.
  await execute(
    `update share_links
        set last_viewed_at = now(),
            first_viewed_at = coalesce(first_viewed_at, now()),
            view_count = view_count + 1
      where id = $1`,
    [linkId]
  );

  if (clientId) await touchClientActivity(clientId);
}

export async function revokeShareLink(id: string): Promise<void> {
  await updateMany("share_links", { revoked: true }, { id });
}

/** Turns a revoked link back on. Nothing else about it changes. */
export async function restoreShareLink(id: string): Promise<void> {
  await updateMany("share_links", { revoked: false }, { id });
}

/** Edits the note the family sees; the link itself is untouched. */
export async function updateShareLinkNotes(id: string, notes: string): Promise<void> {
  await updateMany("share_links", { notes: notes.trim() || null }, { id });
}

export async function updateShareLinkAccessLevel(
  id: string,
  accessLevel: AccessLevel
): Promise<void> {
  await updateMany("share_links", { access_level: accessLevel }, { id });
}

/**
 * Deletes a link outright. The rows joining it to profiles cascade away; any
 * shortlist made through it survives with its share_link_id set to null,
 * because the client's interest in a profile outlives the link that showed it.
 */
export async function deleteShareLink(id: string): Promise<void> {
  await deleteMany("share_links", { id });
}
