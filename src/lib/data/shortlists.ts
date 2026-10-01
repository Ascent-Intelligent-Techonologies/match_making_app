import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { touchClientActivity } from "@/lib/data/clients";

export interface ShortlistedProfile {
  profile_id: string;
  created_at: string;
  full_name: string;
  city: string | null;
}

interface RawShortlistRow {
  profile_id: string;
  created_at: string;
  profiles: { full_name: string; city: string | null } | null;
}

export async function getShortlistedProfileIds(clientId: string): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("client_shortlists")
    .select("profile_id")
    .eq("client_id", clientId);
  if (error) throw error;
  return (data ?? []).map((r) => r.profile_id);
}

export async function listShortlistedProfiles(clientId: string): Promise<ShortlistedProfile[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("client_shortlists")
    .select("profile_id, created_at, profiles(full_name, city)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as RawShortlistRow[]).map((r) => ({
    profile_id: r.profile_id,
    created_at: r.created_at,
    full_name: r.profiles?.full_name ?? "Unknown profile",
    city: r.profiles?.city ?? null,
  }));
}

/**
 * Hearts or un-hearts a profile for a client. Returns the resulting state so
 * the caller can reflect it immediately. Counts as client activity either way.
 */
export async function toggleShortlist(input: {
  clientId: string;
  profileId: string;
  shareLinkId: string | null;
}): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: findError } = await supabase
    .from("client_shortlists")
    .select("id")
    .eq("client_id", input.clientId)
    .eq("profile_id", input.profileId)
    .maybeSingle();
  if (findError) throw findError;

  let shortlisted: boolean;
  if (existing) {
    const { error } = await supabase.from("client_shortlists").delete().eq("id", existing.id);
    if (error) throw error;
    shortlisted = false;
  } else {
    const { error } = await supabase.from("client_shortlists").insert({
      client_id: input.clientId,
      profile_id: input.profileId,
      share_link_id: input.shareLinkId,
    });
    if (error) throw error;
    shortlisted = true;
  }

  await touchClientActivity(input.clientId);
  return shortlisted;
}
