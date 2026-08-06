import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateShareToken } from "@/lib/tokens";
import type { AccessLevel, ShareLink, ShareLinkWithProfiles } from "@/lib/types";

interface RawShareLinkRow extends ShareLink {
  share_link_profiles: { profiles: { id: string; full_name: string; city: string | null } }[];
}

export interface CreateShareLinkInput {
  profileIds: string[];
  accessLevel: AccessLevel;
  expiryDays: number;
  label?: string;
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
    .select("*, share_link_profiles(profiles(id, full_name, city))")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as RawShareLinkRow[]).map((row) => {
    const { share_link_profiles, ...link } = row;
    return {
      ...link,
      profiles: share_link_profiles.map((slp) => slp.profiles),
    };
  });
}

export async function getShareLinkByToken(
  token: string
): Promise<ShareLinkWithProfiles | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("share_links")
    .select("*, share_link_profiles(profiles(id, full_name, city))")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { share_link_profiles, ...link } = data as RawShareLinkRow;
  return { ...link, profiles: share_link_profiles.map((slp) => slp.profiles) };
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
