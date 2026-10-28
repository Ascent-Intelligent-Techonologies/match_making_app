import "server-only";
import {
  countRows,
  deleteMany,
  ilike,
  insertMany,
  notNull,
  query,
  selectMany,
  selectOne,
  updateMany,
  upsertOne,
  type Filters,
  type SelectOptions,
} from "@/lib/db";
import { isUsablePhone, normalizePhone } from "@/lib/phone";
import type { SavedFilters } from "@/lib/search-filters";
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
  // The id breaks ties: profiles imported together share a created_at, and a
  // page boundary inside a tie would repeat some clients and skip others.
  orderBy: "c.created_at desc, c.id",
};

/** How many clients the Clients page shows at once. */
export const CLIENT_PAGE_SIZE = 50;

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

/**
 * Puts a profile's family on the client list, so they can be searched for and
 * shared with without typing them in again. Every profile gets one client,
 * with a phone number or without.
 *
 * Only ever adds or fills in. The client is named like the profile and linked
 * to it, which is what stops a second save adding a second client. The number
 * goes on the client when the profile has a usable one that no other client
 * holds, and a number added to the profile later fills in a client that had
 * none. An existing client is never renamed, and one that was deleted stays
 * deleted (it still counts as the profile's client). Returns whether a client
 * was added.
 */
export async function ensureClientForProfile(profile: {
  id: string;
  full_name: string;
  surname?: string | null;
  contact_phone?: string | null;
}): Promise<boolean> {
  const name = [profile.full_name, profile.surname]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (!name) return false;

  const typed = profile.contact_phone?.trim() ?? "";
  const digits = isUsablePhone(typed) ? normalizePhone(typed) : null;

  const [existing, holder] = await Promise.all([
    selectOne<Pick<Client, "id" | "phone">>("clients", {
      columns: "id, phone",
      where: { profile_id: profile.id },
    }),
    digits
      ? selectOne<Pick<Client, "id">>("clients", { columns: "id", where: { phone: digits } })
      : null,
  ]);

  if (existing) {
    if (!existing.phone && digits && !holder) {
      await updateMany("clients", { phone: digits, phone_display: typed }, { id: existing.id });
    }
    return false;
  }

  await insertMany("clients", [
    {
      full_name: name,
      // A number someone else already holds is kept for reference only.
      phone: holder ? null : digits,
      phone_display: digits ? typed : null,
      profile_id: profile.id,
    },
  ]);
  return true;
}

/** The filters behind the client lists: not deleted, and matching the search. */
function summaryFilters(search?: string): Filters {
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
  return where;
}

/**
 * Clients with their counts.
 *
 * `engagedOnly` leaves out clients made from a profile that nobody has
 * dealt with yet: nothing shared with them, nothing shortlisted, no activity
 * of their own. They are on the list so they can be picked, but they are not
 * part of the work analytics describes.
 */
export async function listClientSummaries(
  search?: string,
  options: { engagedOnly?: boolean } = {}
): Promise<ClientSummary[]> {
  const where = summaryFilters(search);
  if (options.engagedOnly) {
    where.$raw = [
      {
        sql: "c.profile_id is null or c.last_activity_at is not null or s.links > 0 or h.shortlists > 0",
      },
    ];
  }
  return selectMany<ClientSummary>("clients", { ...SUMMARY_QUERY, where });
}

export interface ClientPage {
  clients: ClientSummary[];
  /** Matching the search, not just on this page. */
  total: number;
}

/** One page of the Clients list, plus how many clients match in all. */
export async function listClientSummaryPage(
  search: string | undefined,
  page: number
): Promise<ClientPage> {
  const where = summaryFilters(search);
  const [clients, total] = await Promise.all([
    selectMany<ClientSummary>("clients", {
      ...SUMMARY_QUERY,
      where,
      limit: CLIENT_PAGE_SIZE,
      offset: Math.max(0, page - 1) * CLIENT_PAGE_SIZE,
    }),
    countRows("clients c", where),
  ]);
  return { clients, total };
}

export async function getClientById(id: string): Promise<Client | null> {
  return selectOne<Client>("clients", { where: { id } });
}

/**
 * Keeps the filters just set on the Search page for this client; an empty set
 * clears them. Not a client "activity": it must not touch last_activity_at,
 * which is reserved for the client's own actions.
 */
export async function saveClientSearchFilters(
  clientId: string,
  filters: SavedFilters
): Promise<void> {
  const saved = Object.keys(filters).length > 0 ? JSON.stringify(filters) : null;
  const rows = await updateMany("clients", { search_filters: saved }, { id: clientId });
  if (rows.length === 0) throw new Error("That client no longer exists.");
}

export type ClientMatch = Pick<Client, "id" | "full_name" | "phone_display" | "phone">;

/** How many matches the client picker shows before asking for more typing. */
export const CLIENT_PICKER_LIMIT = 50;

/**
 * Clients matching what was typed in a client picker, by name or by number,
 * names that start with it first. The picker asks as you type rather than
 * loading every client, because that list is as long as the profile book.
 */
export async function searchClients(
  text: string
): Promise<{ clients: ClientMatch[]; more: boolean }> {
  const term = text.trim().slice(0, 100);
  const digits = term.replace(/\D/g, "");

  const rows = await query<ClientMatch>(
    `select id, full_name, phone_display, phone
       from clients
      where deleted_at is null
        and ($1 = ''
             or full_name ilike '%' || $2 || '%'
             or ($3 <> '' and regexp_replace(coalesce(phone, phone_display, ''), '\\D', '', 'g')
                              like '%' || $3 || '%'))
      order by (full_name ilike $2 || '%') desc, full_name
      limit ${CLIENT_PICKER_LIMIT + 1}`,
    [
      term,
      // % and _ typed by the admin mean themselves, not "anything".
      term.replace(/[\\%_]/g, "\\$&"),
      // A few digits are enough to look someone up by number; fewer match everyone.
      digits.length >= 3 ? digits : "",
    ]
  );
  return { clients: rows.slice(0, CLIENT_PICKER_LIMIT), more: rows.length > CLIENT_PICKER_LIMIT };
}

/** Records that a client engaged (opened a link or shortlisted a profile). */
export async function touchClientActivity(clientId: string): Promise<void> {
  await updateMany("clients", { last_activity_at: new Date().toISOString() }, { id: clientId });
}

export interface ClientAnalytics {
  recentlyContacted: ClientSummary[];
  goneQuiet: ClientSummary[];
  neverOpened: ClientSummary[];
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
  const summaries = await listClientSummaries(undefined, { engagedOnly: true });
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

  return {
    recentlyContacted,
    goneQuiet,
    neverOpened,
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
