import "server-only";
import {
  deleteMany,
  ilike,
  notNull,
  selectMany,
  selectOne,
  updateMany,
  upsertOne,
  type Filters,
  type SelectOptions,
} from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import type { Client, ClientSummary } from "@/lib/types";

/** Days of silence after which we consider a client to have gone quiet. */
export const STALE_CLIENT_DAYS = 30;
/** Window used for the "recently contacted" analytics bucket. */
export const RECENT_CONTACT_DAYS = 7;

/**
 * A client with the counts the dashboard reads.
 *
 * The counts are computed in the database rather than by pulling every link
 * and shortlist back and counting them here — the lists are the slow part,
 * and nothing on the page needs the rows themselves. Two lateral joins are
 * past what a generic select can assemble, so the shape is written out once
 * and reused by both callers.
 */
const SUMMARY_QUERY: SelectOptions = {
  from: "clients c",
  columns: `c.*,
            coalesce(s.shared_profiles, 0)::int as "sharedProfileCount",
            coalesce(h.shortlists, 0)::int      as "shortlistedCount",
            coalesce(s.links, 0)::int           as "linkCount",
            s.last_shared_at                    as "lastSharedAt"`,
  joins: `left join lateral (
            select count(distinct slp.profile_id) as shared_profiles,
                   count(distinct l.id)           as links,
                   max(l.created_at)              as last_shared_at
              from share_links l
              left join share_link_profiles slp on slp.share_link_id = l.id
             where l.client_id = c.id
          ) s on true
          left join lateral (
            select count(*) as shortlists
              from client_shortlists cs
             where cs.client_id = c.id
          ) h on true`,
  orderBy: "c.created_at desc",
};

/**
 * Finds the client with this phone number, or creates one. Phone is the
 * identity key, so re-sharing to the same number updates the stored name
 * rather than creating a duplicate client.
 */
export async function upsertClientByPhone(input: {
  fullName: string;
  phone: string;
}): Promise<Client> {
  const phone = normalizePhone(input.phone);

  return upsertOne<Client>(
    "clients",
    {
      phone,
      phone_display: input.phone.trim(),
      full_name: input.fullName.trim(),
      // Re-entering someone's details brings them back rather than silently
      // writing to a row every list is filtering out.
      deleted_at: null,
    },
    "phone",
    { updated_at: "now()" }
  );
}

export async function listClientSummaries(search?: string): Promise<ClientSummary[]> {
  // Soft-deleted clients are hidden from every list but the Deleted page.
  const where: Filters = { "c.deleted_at": null };

  const term = search?.trim();
  if (term) {
    // Match the typed text against the name, and the digits against the phone.
    const digits = normalizePhone(term);
    where.$or = [
      { "c.full_name": ilike(`%${term}%`) },
      ...(digits ? [{ "c.phone": ilike(`%${digits}%`) }] : []),
    ];
  }

  return selectMany<ClientSummary>("clients", { ...SUMMARY_QUERY, where });
}

export async function getClientById(id: string): Promise<Client | null> {
  return selectOne<Client>("clients", { where: { id } });
}

/** Lightweight list used to autocomplete the client fields when sharing. */
export async function listClientsForPicker(): Promise<
  Pick<Client, "id" | "full_name" | "phone_display" | "phone">[]
> {
  return selectMany("clients", {
    columns: "id, full_name, phone_display, phone",
    where: { deleted_at: null },
    orderBy: "full_name",
  });
}

/** Records that a client engaged (opened a link or shortlisted a profile). */
export async function touchClientActivity(clientId: string): Promise<void> {
  await updateMany("clients", { last_activity_at: new Date().toISOString() }, { id: clientId });
}

export interface ClientAnalytics {
  recentlyContacted: ClientSummary[];
  goneQuiet: ClientSummary[];
  neverOpened: ClientSummary[];
  /** Details were taken but nothing was ever sent to them. */
  neverContacted: ClientSummary[];
  totalClients: number;
  totalShortlists: number;
}

/**
 * The admin analytics buckets.
 *
 * "Contacted" is when a share link was created for the client (or when the
 * client was added, for walk-ins). "Responded" is any engagement by them —
 * opening a link or hearting a profile.
 */
export async function getClientAnalytics(): Promise<ClientAnalytics> {
  const summaries = await listClientSummaries();
  const now = Date.now();
  const recentCutoff = now - RECENT_CONTACT_DAYS * 86_400_000;
  const staleCutoff = now - STALE_CLIENT_DAYS * 86_400_000;

  const contactedAt = (c: ClientSummary) =>
    new Date(c.lastSharedAt ?? c.created_at).getTime();
  const activityAt = (c: ClientSummary) =>
    c.last_activity_at ? new Date(c.last_activity_at).getTime() : null;

  const recentlyContacted = summaries
    .filter((c) => contactedAt(c) >= recentCutoff)
    .sort((a, b) => contactedAt(b) - contactedAt(a));

  // Silent for 30+ days, and contacted long enough ago that the silence means
  // something — someone contacted yesterday hasn't had a chance to reply yet.
  const goneQuiet = summaries
    .filter((c) => {
      const act = activityAt(c);
      return contactedAt(c) < staleCutoff && (act === null || act < staleCutoff);
    })
    .sort((a, b) => contactedAt(a) - contactedAt(b));

  const neverOpened = summaries
    .filter((c) => c.last_activity_at === null && c.linkCount > 0)
    .sort((a, b) => contactedAt(a) - contactedAt(b));

  // Distinct from "never opened": nothing was ever sent to these people at
  // all. Usually details taken down on a call and then forgotten about, so
  // the oldest are the ones most worth chasing.
  const neverContacted = summaries
    .filter((c) => c.linkCount === 0)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return {
    recentlyContacted,
    goneQuiet,
    neverOpened,
    neverContacted,
    totalClients: summaries.length,
    totalShortlists: summaries.reduce((n, c) => n + c.shortlistedCount, 0),
  };
}

/** Profile ids already shared with this client, used to grey out search hits. */
export async function getSharedProfileIdsForClient(clientId: string): Promise<string[]> {
  const rows = await selectMany<{ profile_id: string }>("share_links", {
    from: "share_links l",
    joins: "join share_link_profiles slp on slp.share_link_id = l.id",
    columns: "distinct slp.profile_id",
    where: { "l.client_id": clientId },
  });
  return rows.map((r) => r.profile_id);
}

/** Hides a client without destroying anything. Reversible from the Deleted page. */
export async function softDeleteClient(id: string): Promise<void> {
  await updateMany("clients", { deleted_at: new Date().toISOString() }, { id });
}

export async function restoreClient(id: string): Promise<void> {
  await updateMany("clients", { deleted_at: null }, { id });
}

export async function listDeletedClients(): Promise<Client[]> {
  return selectMany<Client>("clients", {
    where: { deleted_at: notNull() },
    orderBy: "deleted_at desc",
  });
}

/**
 * Removes a client and everything recorded about them.
 *
 * Their shortlists, searches and follow-ups go by foreign-key cascade. Their
 * share links do not: the column is `on delete set null`, which would leave
 * live links pointing at nobody. A link was created to show profiles to this
 * person, so removing the person closes the link too, and it is deleted first
 * while the attribution still exists to find it by.
 */
export async function deleteClient(id: string): Promise<void> {
  await deleteMany("share_links", { client_id: id });
  await deleteMany("clients", { id });
}
