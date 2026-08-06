import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_SHARE_EXPIRY_DAYS } from "@/lib/constants";
import type { AppSettings } from "@/lib/types";

export async function getAppSettings(): Promise<AppSettings> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return data ?? { id: 1, default_expiry_days: DEFAULT_SHARE_EXPIRY_DAYS };
}

export async function updateDefaultExpiryDays(days: number): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, default_expiry_days: days });
  if (error) throw error;
}
