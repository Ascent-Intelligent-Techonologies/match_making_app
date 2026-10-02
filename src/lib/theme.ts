/**
 * The theme palette, and everything derived from it.
 *
 * `globals.css` holds the defaults so the app still renders correctly with no
 * database and no saved settings. When the admin saves colours we re-declare
 * the same custom properties inline on <html>, which outranks the `:root`
 * rule, so one small style attribute re-themes every page.
 *
 * Shared by server and client: no "server-only" here, the settings page uses
 * the same functions to preview and to warn about contrast.
 */

export interface ThemeColors {
  /** Buttons, headings, links, and the page's background tints. */
  primary: string;
  orange: string;
  /** Badge fills and hairline borders. Its text shade is derived, not stored. */
  gold: string;
  olive: string;
  blueDeep: string;
  blueBright: string;
}

/** Must stay in step with the `:root` block in globals.css. */
export const DEFAULT_THEME: ThemeColors = {
  primary: "#e65a7f",
  orange: "#fb5d2e",
  gold: "#fbc056",
  olive: "#648127",
  blueDeep: "#015e9d",
  blueBright: "#0091e0",
};

export const THEME_FIELDS: {
  key: keyof ThemeColors;
  label: string;
  description: string;
}[] = [
  {
    key: "primary",
    label: "Primary",
    description: "Buttons, headings, links and the soft page background.",
  },
  { key: "gold", label: "Gold", description: "Badges, card borders and outlines." },
  { key: "olive", label: "Olive", description: "The AnuRupa wordmark and the All Profiles tile." },
  { key: "orange", label: "Orange", description: "The Dashboard tile and highlight accents." },
  { key: "blueDeep", label: "Deep blue", description: "The Search tile and deep headings." },
  { key: "blueBright", label: "Bright blue", description: "Informational accents and links on dark fills." },
];

/* ---------------------------------------------------------------- colour maths */

export function normalizeHex(value: string): string | null {
  const raw = value.trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.replace(/./g, (c) => c + c) : raw;
  return /^[0-9a-fA-F]{6}$/.test(full) ? `#${full.toLowerCase()}` : null;
}

function toRgb(hex: string): [number, number, number] {
  const n = normalizeHex(hex) ?? "#000000";
  return [
    parseInt(n.slice(1, 3), 16),
    parseInt(n.slice(3, 5), 16),
    parseInt(n.slice(5, 7), 16),
  ];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Mixes a colour with white. `amount` is how much of the colour survives. */
function tint(hex: string, amount: number): string {
  const [r, g, b] = toRgb(hex);
  return toHex([
    255 + amount * (r - 255),
    255 + amount * (g - 255),
    255 + amount * (b - 255),
  ]);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Darkens a colour until small text in it is legible on a near-white page.
 *
 * The gold is the reason this exists: as a fill it is exactly right, but as
 * 11px label text it measures around 2:1 and simply cannot be read. Rather
 * than quietly changing the admin's gold, we keep the fill exact and derive a
 * separate shade for text.
 */
export function readableTextShade(hex: string, on = "#ffffff", target = 4.5): string {
  let candidate = normalizeHex(hex) ?? "#000000";
  for (let i = 0; i < 60 && contrastRatio(candidate, on) < target; i++) {
    const [r, g, b] = toRgb(candidate);
    candidate = toHex([r * 0.95, g * 0.95, b * 0.95]);
  }
  return candidate;
}

/* ------------------------------------------------------------- derived tokens */

/**
 * Expands the six colours into every custom property the components use.
 * The tint amounts are chosen so the default primary reproduces the blush
 * scale already in globals.css.
 */
export function themeCssVars(colors: ThemeColors): Record<string, string> {
  return {
    "--color-rose-400": colors.primary,
    "--color-maroon-600": colors.primary,
    "--color-maroon-700": colors.primary,
    "--color-maroon-800": colors.blueDeep,
    "--color-orange-500": colors.orange,
    "--color-gold-400": colors.gold,
    "--color-gold-500": readableTextShade(colors.gold),
    "--color-olive-500": colors.olive,
    "--color-olive-600": colors.olive,
    "--color-blue-600": colors.blueDeep,
    "--color-blue-400": colors.blueBright,
    "--color-blush-50": tint(colors.primary, 0.055),
    "--color-blush-100": tint(colors.primary, 0.133),
    "--color-blush-200": tint(colors.primary, 0.267),
    "--color-blush-300": tint(colors.primary, 0.527),
  };
}

/** Anything unparseable or missing falls back to the default for that slot. */
export function sanitizeTheme(input: unknown): ThemeColors {
  const source = (input ?? {}) as Partial<Record<keyof ThemeColors, unknown>>;
  const out = { ...DEFAULT_THEME };
  for (const { key } of THEME_FIELDS) {
    const hex = typeof source[key] === "string" ? normalizeHex(source[key] as string) : null;
    if (hex) out[key] = hex;
  }
  return out;
}

export function isDefaultTheme(colors: ThemeColors): boolean {
  return THEME_FIELDS.every(({ key }) => colors[key] === DEFAULT_THEME[key]);
}

/* ---------------------------------------------------------- legibility advice */

export interface ContrastCheck {
  label: string;
  ratio: number;
  minimum: number;
}

/**
 * Advisory only. We show these and still save what was asked for — the choice
 * of brand colour belongs to the admin, not to us.
 *
 * Everything checked here is a short bold label or a UI fill (button captions,
 * tile letters, headings), never body copy, so 3:1 — WCAG's large-text and
 * non-text floor — is the honest threshold. Warning at the 4.5:1 body-text
 * level would flag almost any saturated brand colour and so mean nothing; at
 * 3:1 a warning marks something genuinely unreadable.
 */
export function themeContrastChecks(colors: ThemeColors): ContrastCheck[] {
  const page = tint(colors.primary, 0.055);
  const check = (label: string, a: string, b: string): ContrastCheck => ({
    label,
    ratio: contrastRatio(a, b),
    minimum: 3,
  });
  return [
    check("White text on primary buttons", "#ffffff", colors.primary),
    check("Headings and links on the page background", colors.primary, page),
    check("The AnuRupa wordmark in olive", colors.olive, page),
    check("White text on the orange tile", "#ffffff", colors.orange),
    check("White text on the olive tile", "#ffffff", colors.olive),
    check("White text on the deep blue tile", "#ffffff", colors.blueDeep),
    check("White text on bright blue", "#ffffff", colors.blueBright),
  ];
}
