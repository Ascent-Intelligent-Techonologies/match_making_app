import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import type { Client, ClientSummary } from "@/lib/types";

/** Days of silence after which we consider a client to have gone quiet. */
export const STALE_CLIENT_DAYS = 30;
/** Window used for the "recently contacted" analytics bucket. */
export const RECENT_CONTACT_DAYS = 7;

interface RawClientRow extends Client {
  share_links: {
    id: string;
    created_at: string;
    share_link_profiles: { profile_id: string }[];
  }[];
  client_shortlists: { profile_id: string }[];
}

const SUMMARY_SELECT =
  "*, share_links(id, created_at, share_link_profiles(profile_id)), client_shortlists(profile_id)";

function toSummary(row: RawClientRow): ClientSummary {
  const { share_links, client_shortlists, ...client } = row;
  const sharedProfileIds = new Set<string>();
  let lastSharedAt: string | null = null;

  for (const link of share_links ?? []) {
    for (const slp of link.share_link_profiles ?? []) sharedProfileIds.add(slp.profile_id);
    if (!lastSharedAt || link.created_at > lastSharedAt) lastSharedAt = link.created_at;
  }

  return {
    ...client,
    sharedProfileCount: sharedProfileIds.size,
    shortlistedCount: (client_shortlists ?? []).length,
    linkCount: (share_links ?? []).length,
    lastSharedAt,
  };
}

/**
 * Finds the client with this phone number, or creates one. Phone is the
 * identity key, so re-sharing to the same number updates the stored name
 * rather than creating a duplicate client.
 */
export async function upsertClientByPhone(input: {
  fullName: string;
  phone: string;
}): Promise<Client> {
  const supabase = getSupabaseAdmin();
  const phone = normalizePhone(input.phone);

  const { data, error } = await supabase
    .from("clients")
    .upsert(
      {
        phone,
        phone_display: input.phone.trim(),
        full_name: input.fullName.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "phone" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listClientSummaries(search?: string): Promise<ClientSummary[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("clients").select(SUMMARY_SELECT);

  const term = search?.trim();
  if (term) {
    // Match the typed text against the name, and the digits against the phone.
    const digits = normalizePhone(term);
    const clauses = [`full_name.ilike.*${term}*`];
    if (digits) clauses.push(`phone.ilike.*${digits}*`);
    query = query.or(clauses.join(","));
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as RawClientRow[]).map(toSummary);
}

export async function getClientById(id: string): Promise<Client | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Lightweight list used to autocomplete the client fields when sharing. */
export async function listClientsForPicker(): Promise<
  Pick<Client, "id" | "full_name" | "phone_display" | "phone">[]
> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("clients")
    .select("id, full_name, phone_display, phone")
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}

/** Records that a client engaged (opened a link or shortlisted a profile). */
export async function touchClientActivity(clientId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("clients")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", clientId);
  if (error) throw error;
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
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("share_links")
    .select("share_link_profiles(profile_id)")
    .eq("client_id", clientId);
  if (error) throw error;

  const ids = new Set<string>();
  for (const row of (data ?? []) as { share_link_profiles: { profile_id: string }[] }[]) {
    for (const slp of row.share_link_profiles ?? []) ids.add(slp.profile_id);
  }
  return Array.from(ids);
}
