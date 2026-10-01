import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateShareToken } from "@/lib/tokens";
import { touchClientActivity } from "@/lib/data/clients";
import type { AccessLevel, ShareLink, ShareLinkWithProfiles } from "@/lib/types";

interface RawShareLinkRow extends ShareLink {
  share_link_profiles: { profiles: { id: string; full_name: string; city: string | null } }[];
  clients: { id: string; full_name: string; phone_display: string | null } | null;
}

const LINK_SELECT =
  "*, share_link_profiles(profiles(id, full_name, city)), clients(id, full_name, phone_display)";

function toLinkWithProfiles(row: RawShareLinkRow): ShareLinkWithProfiles {
  const { share_link_profiles, clients, ...link } = row;
  return {
    ...link,
    profiles: (share_link_profiles ?? []).map((slp) => slp.profiles),
    client: clients,
  };
}

export interface CreateShareLinkInput {
  profileIds: string[];
  accessLevel: AccessLevel;
  expiryDays: number;
  label?: string;
  clientId: string;
}

export async function createShareLink(input: CreateShareLinkInput): Promise<ShareLink> {
  const supabase = getSupabaseAdmin();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + input.expiryDays);

  const { data: link, error } = await supabase
    .from("share_links")
    .insert({
      token: generateShareToken(),
      label: input.label || null,
      access_level: input.accessLevel,
      expires_at: expiresAt.toISOString(),
      client_id: input.clientId,
    })
    .select("*")
    .single();
  if (error) throw error;

  const { error: joinError } = await supabase.from("share_link_profiles").insert(
    input.profileIds.map((profileId) => ({
      share_link_id: link.id,
      profile_id: profileId,
    }))
  );
  if (joinError) throw joinError;

  return link;
}

export async function listShareLinks(): Promise<ShareLinkWithProfiles[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("share_links")
    .select(LINK_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as RawShareLinkRow[]).map(toLinkWithProfiles);
}

export async function listShareLinksForClient(clientId: string): Promise<ShareLinkWithProfiles[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("share_links")
    .select(LINK_SELECT)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as RawShareLinkRow[]).map(toLinkWithProfiles);
}

export async function getShareLinkByToken(
  token: string
): Promise<ShareLinkWithProfiles | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("share_links")
    .select(LINK_SELECT)
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return toLinkWithProfiles(data as RawShareLinkRow);
}

/**
 * Marks a link as opened. Called when the client loads the share page, and is
 * what the "has this client responded?" analytics read from.
 */
export async function recordShareLinkView(
  linkId: string,
  clientId: string | null,
  currentViewCount: number,
  firstViewedAt: string | null
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("share_links")
    .update({
      last_viewed_at: now,
      first_viewed_at: firstViewedAt ?? now,
      view_count: (currentViewCount ?? 0) + 1,
    })
    .eq("id", linkId);
  if (error) throw error;

  if (clientId) await touchClientActivity(clientId);
}

export async function revokeShareLink(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("share_links").update({ revoked: true }).eq("id", id);
  if (error) throw error;
}

export async function extendShareLink(id: string, additionalDays: number): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: link, error: fetchError } = await supabase
    .from("share_links")
    .select("expires_at")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;

  const base = new Date(link.expires_at) > new Date() ? new Date(link.expires_at) : new Date();
  base.setDate(base.getDate() + additionalDays);

  const { error } = await supabase
    .from("share_links")
    .update({ expires_at: base.toISOString(), revoked: false })
    .eq("id", id);
  if (error) throw error;
}

export async function updateShareLinkAccessLevel(
  id: string,
  accessLevel: AccessLevel
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("share_links")
    .update({ access_level: accessLevel })
    .eq("id", id);
  if (error) throw error;
}
