import "server-only";
import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DEFAULT_SHARE_EXPIRY_DAYS } from "@/lib/constants";
import { DEFAULT_THEME, sanitizeTheme, type ThemeColors } from "@/lib/theme";
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

/**
 * The palette for the root layout to apply.
 *
 * Deduped per request because the root layout renders on every page, and
 * deliberately fault-tolerant: a colour lookup must never be the reason a
 * page fails to render, so anything unexpected falls back to the defaults
 * baked into globals.css.
 */
export const getThemeColors = cache(async (): Promise<ThemeColors> => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("app_settings")
      .select("theme_colors")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data?.theme_colors) return DEFAULT_THEME;
    return sanitizeTheme(data.theme_colors);
  } catch {
    return DEFAULT_THEME;
  }
});

export async function updateThemeColors(colors: ThemeColors | null): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, theme_colors: colors });
  if (error) throw error;
}
