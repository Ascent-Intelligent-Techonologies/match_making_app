"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { AlertTriangle, Check, Palette, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { saveThemeAction, type ThemeState } from "@/lib/actions/settings";
import {
  DEFAULT_THEME,
  THEME_FIELDS,
  normalizeHex,
  themeContrastChecks,
  themeCssVars,
  type ThemeColors,
} from "@/lib/theme";

/** The derived tokens worth showing, so the admin can see what a change did. */
const DERIVED = [
  { var: "--color-blush-50", label: "Page background" },
  { var: "--color-blush-100", label: "Hover tint" },
  { var: "--color-blush-200", label: "Soft fill" },
  { var: "--color-blush-300", label: "Input border" },
  { var: "--color-gold-500", label: "Badge text" },
];

export function ThemeSettingsForm({ initial }: { initial: ThemeColors }) {
  const [colors, setColors] = useState<ThemeColors>(initial);
  const [state, formAction, pending] = useActionState<ThemeState, FormData>(
    saveThemeAction,
    {}
  );

  // Everything below previews against the colours in the boxes right now, not
  // the saved ones, so the effect of a change is visible before saving.
  const vars = themeCssVars(colors);
  const previewStyle = vars as CSSProperties;
  const checks = themeContrastChecks(colors);
  const failing = checks.filter((c) => c.ratio < c.minimum);

  function set(key: keyof ThemeColors, value: string) {
    setColors((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex flex-1 flex-col gap-6">
        <Card className="flex flex-col gap-5 p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {THEME_FIELDS.map(({ key, label, description }) => {
              const value = colors[key];
              const valid = normalizeHex(value);
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`theme-${key}`}
                    className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80"
                  >
                    {label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={`${label} colour picker`}
                      value={valid ?? "#000000"}
                      onChange={(e) => set(key, e.target.value)}
                      className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-blush-300 bg-white/70 p-1"
                    />
                    <input
                      id={`theme-${key}`}
                      name={key}
                      value={value}
                      onChange={(e) => set(key, e.target.value)}
                      spellCheck={false}
                      className="w-full rounded-lg border border-blush-300 bg-white/70 px-3 py-2.5 font-mono text-[15px] uppercase text-ink-900 focus:border-maroon-600 focus:outline-none focus:ring-2 focus:ring-maroon-600/15"
                    />
                  </div>
                  <p className="text-xs text-ink-900/50">{description}</p>
                  {!valid && (
                    <p className="text-xs text-red-700">Use a hex value such as #E65A7F.</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 border-t border-gold-400/25 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
              Derived automatically
            </p>
            <div className="flex flex-wrap gap-3" style={previewStyle}>
              {DERIVED.map((d) => (
                <div key={d.var} className="flex items-center gap-2">
                  <span
                    className="h-7 w-7 rounded-full border border-ink-900/10"
                    style={{ background: vars[d.var] }}
                  />
                  <span className="text-xs text-ink-900/60">
                    {d.label}
                    <span className="ml-1 font-mono uppercase text-ink-900/40">
                      {vars[d.var]}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-ink-900/50">
              Backgrounds are tinted from the primary colour. The badge text shade is
              darkened from the gold until small text on it is readable — the gold fill
              itself is used exactly as entered.
            </p>
          </div>
        </Card>

        {failing.length > 0 && (
          <Card className="flex flex-col gap-2 border-gold-400/50 bg-gold-400/10 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-gold-500">
              <AlertTriangle size={15} /> These combinations may be hard to read
            </p>
            <ul className="flex flex-col gap-1">
              {failing.map((c) => (
                <li key={c.label} className="text-xs text-ink-900/70">
                  {c.label} — {c.ratio.toFixed(1)}:1, below the {c.minimum}:1 guideline
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-900/50">
              Advisory only. Your colours are saved exactly as entered.
            </p>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" name="intent" value="save" disabled={pending}>
            <Palette size={15} /> {pending ? "Saving…" : "Save colours"}
          </Button>
          <Button
            type="submit"
            name="intent"
            value="reset"
            variant="secondary"
            disabled={pending}
            onClick={() => setColors(DEFAULT_THEME)}
          >
            <RotateCcw size={15} /> Reset to defaults
          </Button>
          {state.savedAt && !state.error && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-olive-600">
              <Check size={15} />
              {state.reset ? "Restored the default palette." : "Saved across the whole app."}
            </span>
          )}
          {state.error && <span className="text-sm text-red-700">{state.error}</span>}
        </div>
      </div>

      <ThemePreview style={previewStyle} />
    </form>
  );
}

/** A miniature of the real UI, themed by the inline variables alone. */
function ThemePreview({ style }: { style: CSSProperties }) {
  return (
    <div
      style={style}
      className="w-full shrink-0 rounded-3xl border border-gold-400/30 bg-blush-50 p-5 lg:sticky lg:top-24 lg:w-80"
    >
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
        Preview
      </p>

      <div className="flex flex-col gap-4">
        <p className="font-serif text-xl font-semibold text-olive-500">
          AnuRupa{" "}
          <span className="font-sans text-[10px] uppercase tracking-widest text-maroon-700/60">
            Admin
          </span>
        </p>

        <div className="grid grid-cols-4 gap-2">
          {["bg-maroon-600", "bg-blue-600", "bg-olive-500", "bg-orange-500"].map((bg) => (
            <span
              key={bg}
              className={`flex h-10 items-center justify-center rounded-full text-[10px] font-semibold text-white ${bg}`}
            >
              Aa
            </span>
          ))}
        </div>

        <div className="rounded-2xl border border-gold-400/25 bg-white/60 p-4">
          <h3 className="font-serif text-lg font-semibold text-maroon-700">Sravani R.</h3>
          <p className="text-xs text-ink-900/60">28 years · Hyderabad</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-gold-400/20 px-2.5 py-1 text-[11px] font-semibold text-gold-500">
              Reddy
            </span>
            <span className="rounded-full bg-blush-200 px-2.5 py-1 text-[11px] font-semibold text-maroon-700">
              5&apos;4&quot;
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-maroon-600 px-4 py-2 text-xs font-medium text-blush-50">
            Share link
          </span>
          <span className="inline-flex items-center rounded-full border border-gold-400 px-4 py-2 text-xs font-medium text-maroon-700">
            Edit
          </span>
        </div>

        <input
          readOnly
          value="Search profiles"
          className="w-full rounded-lg border border-blush-300 bg-white/70 px-3 py-2 text-xs text-ink-900/60"
        />
      </div>
    </div>
  );
}
