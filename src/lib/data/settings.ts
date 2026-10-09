import "server-only";
import { cache } from "react";
import { execute, maybeOne } from "@/lib/db";
import { DEFAULT_THEME, sanitizeTheme, type ThemeColors } from "@/lib/theme";
import type { AppSettings } from "@/lib/types";

export async function getAppSettings(): Promise<AppSettings> {
  const row = await maybeOne<AppSettings>("select * from app_settings where id = 1");
  return row ?? { id: 1 };
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
    const row = await maybeOne<{ theme_colors: ThemeColors | null }>(
      "select theme_colors from app_settings where id = 1"
    );
    if (!row?.theme_colors) return DEFAULT_THEME;
    return sanitizeTheme(row.theme_colors);
  } catch {
    return DEFAULT_THEME;
  }
});

export async function updateThemeColors(colors: ThemeColors | null): Promise<void> {
  await execute(
    `insert into app_settings (id, theme_colors)
     values (1, $1)
     on conflict (id) do update set theme_colors = excluded.theme_colors`,
    [colors === null ? null : JSON.stringify(colors)]
  );
}
