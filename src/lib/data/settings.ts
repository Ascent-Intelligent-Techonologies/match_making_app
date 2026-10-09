import "server-only";
import { cache } from "react";
import { selectOne, upsertOne } from "@/lib/db";
import { DEFAULT_THEME, sanitizeTheme, type ThemeColors } from "@/lib/theme";
import type { AppSettings } from "@/lib/types";

export async function getAppSettings(): Promise<AppSettings> {
  const row = await selectOne<AppSettings>("app_settings", { where: { id: 1 } });
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
    const row = await selectOne<{ theme_colors: ThemeColors | null }>("app_settings", {
      columns: "theme_colors",
      where: { id: 1 },
    });
    if (!row?.theme_colors) return DEFAULT_THEME;
    return sanitizeTheme(row.theme_colors);
  } catch {
    return DEFAULT_THEME;
  }
});

export async function updateThemeColors(colors: ThemeColors | null): Promise<void> {
  await upsertOne(
    "app_settings",
    { id: 1, theme_colors: colors === null ? null : JSON.stringify(colors) },
    "id"
  );
}
