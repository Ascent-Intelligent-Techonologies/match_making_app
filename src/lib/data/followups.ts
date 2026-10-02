import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface ClientFollowup {
  id: string;
  client_id: string;
  note: string;
  created_at: string;
}

export interface FollowupWithClient extends ClientFollowup {
  client: { id: string; full_name: string; phone_display: string | null; phone: string } | null;
}

export async function addFollowup(input: {
  clientId: string;
  note: string;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("client_followups")
    .insert({ client_id: input.clientId, note: input.note.trim() });
  if (error) throw error;

  // Deliberately does NOT touch clients.last_activity_at. That column means
  // "the client responded"; a follow-up is us contacting them, and counting it
  // would make silent clients look engaged in the dashboard.
}

export async function listFollowupsForClient(clientId: string): Promise<ClientFollowup[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("client_followups")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listRecentFollowups(limit = 15): Promise<FollowupWithClient[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("client_followups")
    .select("*, clients(id, full_name, phone_display, phone)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return ((data ?? []) as unknown as (ClientFollowup & { clients: FollowupWithClient["client"] })[])
    .map(({ clients, ...f }) => ({ ...f, client: clients }));
}
