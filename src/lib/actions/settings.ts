"use server";

import { revalidatePath } from "next/cache";
import { updateThemeColors } from "@/lib/data/settings";
import { THEME_FIELDS, normalizeHex, type ThemeColors } from "@/lib/theme";

export interface ThemeState {
  error?: string;
  savedAt?: number;
  reset?: boolean;
}

/** Colours live in the layout, so every route has to be re-rendered. */
function revalidateEverything() {
  revalidatePath("/", "layout");
}

/**
 * Saves, turning the one predictable failure into something actionable: the
 * column arrives with migration 005, which has to be run by hand.
 */
async function save(colors: ThemeColors | null): Promise<ThemeState> {
  try {
    await updateThemeColors(colors);
  } catch (error) {
    // Not every driver rejects with a real Error, so unwrap defensively.
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
    if (/theme_colors/.test(message)) {
      return {
        error:
          "The theme_colors column is missing — run supabase/migrations/005_theme_colors.sql against the database, then save again.",
      };
    }
    return { error: `Could not save the colours: ${message}` };
  }
  revalidateEverything();
  return { savedAt: Date.now(), reset: colors === null };
}

export async function saveThemeAction(
  _prev: ThemeState,
  formData: FormData
): Promise<ThemeState> {
  if (formData.get("intent") === "reset") {
    return save(null);
  }

  const colors = {} as ThemeColors;
  for (const { key, label } of THEME_FIELDS) {
    const hex = normalizeHex(String(formData.get(key) ?? ""));
    if (!hex) return { error: `${label} needs to be a hex colour such as #e65a7f.` };
    colors[key] = hex;
  }

  // Legibility is advisory — warnings are shown in the page, and we save what
  // was asked for. Only an unusable value (above) is refused.
  return save(colors);
}
