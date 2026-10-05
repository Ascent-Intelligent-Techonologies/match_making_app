"use client";

import { Input, Select } from "@/components/ui/Field";

/** Shared label styling, so every filter in every bar reads the same. */
export function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
      {children}
    </span>
  );
}

export function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: readonly string[] | readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const normalised = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );
  return (
    <div className="flex flex-col gap-1">
      <FilterLabel>{label}</FilterLabel>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {normalised.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function RangePair({
  label,
  minKey,
  maxKey,
  minValue,
  maxValue,
  onChange,
}: {
  label: string;
  minKey: string;
  maxKey: string;
  minValue: string;
  maxValue: string;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <FilterLabel>{label}</FilterLabel>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder="More than"
          defaultValue={minValue}
          onChange={(e) => onChange(minKey, e.target.value)}
        />
        <Input
          type="number"
          placeholder="Less than"
          defaultValue={maxValue}
          onChange={(e) => onChange(maxKey, e.target.value)}
        />
      </div>
    </div>
  );
}

/**
 * A filter that is either on or absent from the URL entirely — there is no
 * "show me the ones that are not urgent", so it is a checkbox, not a tri-state.
 */
export function FilterToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 self-end rounded-lg border border-blush-200 bg-white/60 px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-blush-300 text-maroon-600 focus:ring-maroon-600"
      />
      <span>
        <span className="text-sm font-medium text-ink-900/80">{label}</span>
        {hint && <span className="block text-[11px] text-ink-900/50">{hint}</span>}
      </span>
    </label>
  );
}

/**
 * A filter that can hold several values at once, kept in one URL parameter as
 * a comma-joined list. Checkboxes rather than a multi-select, because there
 * are only a handful of options and none of them should need opening a menu.
 */
export function FilterCheckboxGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <FilterLabel>{label}</FilterLabel>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <label
              key={o}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm ${
                on
                  ? "border-maroon-600 bg-blush-100 text-maroon-700"
                  : "border-blush-200 bg-white/60 text-ink-900/70"
              }`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, o]
                      : selected.filter((s) => s !== o)
                  )
                }
                className="h-4 w-4 rounded border-blush-300 text-maroon-600 focus:ring-maroon-600"
              />
              {o}
            </label>
          );
        })}
      </div>
    </div>
  );
}
