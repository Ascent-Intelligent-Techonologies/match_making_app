import "server-only";
import { execute, query } from "@/lib/db";
import { touchClientActivity } from "@/lib/data/clients";

export interface ShortlistedProfile {
  profile_id: string;
  created_at: string;
  full_name: string;
  city: string | null;
}

export async function getShortlistedProfileIds(clientId: string): Promise<string[]> {
  const rows = await query<{ profile_id: string }>(
    "select profile_id from client_shortlists where client_id = $1",
    [clientId]
  );
  return rows.map((r) => r.profile_id);
}

export async function listShortlistedProfiles(clientId: string): Promise<ShortlistedProfile[]> {
  // Left-joined: a shortlist outlives a hard-deleted profile, and the client
  // having hearted something is worth showing even once it is gone.
  return query<ShortlistedProfile>(
    `select cs.profile_id,
            cs.created_at,
            coalesce(p.full_name, 'Unknown profile') as full_name,
            p.city
       from client_shortlists cs
       left join profiles p on p.id = cs.profile_id
      where cs.client_id = $1
      order by cs.created_at desc`,
    [clientId]
  );
}

/**
 * Hearts or un-hearts a profile for a client, in one statement each way so
 * two taps in quick succession cannot both see "not there yet" and insert
 * twice. Returns the resulting state so the caller can reflect it
 * immediately.
 */
async function toggle(clientId: string, profileId: string, shareLinkId: string | null) {
  const removed = await execute(
    "delete from client_shortlists where client_id = $1 and profile_id = $2",
    [clientId, profileId]
  );
  if (removed > 0) return false;

  await execute(
    `insert into client_shortlists (client_id, profile_id, share_link_id)
     values ($1, $2, $3)
     on conflict (client_id, profile_id) do nothing`,
    [clientId, profileId, shareLinkId]
  );
  return true;
}

/** The client's own heart. Counts as client activity either way. */
export async function toggleShortlist(input: {
  clientId: string;
  profileId: string;
  shareLinkId: string | null;
}): Promise<boolean> {
  const shortlisted = await toggle(input.clientId, input.profileId, input.shareLinkId);
  await touchClientActivity(input.clientId);
  return shortlisted;
}

/**
 * Admin-side removal of a shortlist entry, for when a client says they are no
 * longer interested. Unlike the client's own heart this does not touch
 * last_activity_at: that column records when the client was last active, and
 * our tidying up is not their activity.
 */
export async function removeShortlist(clientId: string, profileId: string): Promise<void> {
  await execute(
    "delete from client_shortlists where client_id = $1 and profile_id = $2",
    [clientId, profileId]
  );
}

/**
 * Admin-side toggle, for shortlisting on a client's behalf while searching.
 *
 * Unlike the client's own heart this leaves last_activity_at alone: that
 * column records when the CLIENT was last active, and us ticking a box on
 * their behalf would make a silent client look engaged in the dashboard.
 */
export async function toggleShortlistForAdmin(
  clientId: string,
  profileId: string
): Promise<boolean> {
  return toggle(clientId, profileId, null);
}
