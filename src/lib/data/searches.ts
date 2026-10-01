import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export interface ClientSearch {
  id: string;
  client_id: string;
  filters: Record<string, string>;
  result_count: number | null;
  created_at: string;
}

export async function recordClientSearch(input: {
  clientId: string;
  filters: Record<string, string>;
  resultCount: number;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("client_searches").insert({
    client_id: input.clientId,
    filters: input.filters,
    result_count: input.resultCount,
  });
  if (error) throw error;
}

export async function listClientSearches(
  clientId: string,
  limit = 25
): Promise<ClientSearch[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("client_searches")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
