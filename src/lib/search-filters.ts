/**
 * The filters on the admin Search page that are kept for each client.
 *
 * Shared by the page (to restore them), the filter bar (to save them) and the
 * save action (to refuse anything else), so all three agree on what counts.
 * The name-search box is deliberately not here: it is a lookup of one person,
 * and bringing it back on the next visit would hide everyone else.
 */
export const SAVED_FILTER_KEYS = [
  "gender",
  "caste",
  "professionCategory",
  "tags",
  "minAge",
  "maxAge",
  "minHeightFt",
  "minHeightIn",
  "maxHeightFt",
  "maxHeightIn",
  "minFinances",
  "maxFinances",
  "urgent",
  "potentialClient",
  "anurupaAura",
] as const;

export type SavedFilters = Partial<Record<(typeof SAVED_FILTER_KEYS)[number], string>>;

/**
 * The saved filters inside anything shaped like a set of URL parameters (or a
 * stored value, or whatever a client sent): known names only, text values
 * only, nothing blank. Everything else is dropped, never trusted.
 */
export function sanitizeFilters(input: unknown): SavedFilters {
  const clean: SavedFilters = {};
  if (typeof input !== "object" || input === null) return clean;

  const source = input as Record<string, unknown>;
  for (const key of SAVED_FILTER_KEYS) {
    const raw = Array.isArray(source[key]) ? source[key][0] : source[key];
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (value && value.length <= 200) clean[key] = value;
  }
  return clean;
}

/**
 * Added to the address when the filters have been cleared on purpose. Without
 * it a bare address means "just opened", and the page would put the client's
 * saved filters straight back.
 */
export const UNFILTERED_PARAM = "unfiltered";
