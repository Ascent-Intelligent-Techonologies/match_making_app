"use client";

import { Input } from "@/components/ui/Field";

/**
 * Height range expressed the way families talk about it — feet and inches —
 * rather than the centimetres we store it in.
 */
export function HeightRangeFilter({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const box = (key: string, placeholder: string, max: number) => (
    <Input
      type="number"
      min={0}
      max={max}
      placeholder={placeholder}
      aria-label={placeholder}
      defaultValue={values[key] ?? ""}
      onChange={(e) => onChange(key, e.target.value)}
      className="px-2 text-center"
    />
  );

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
        Height
      </span>
      <div className="flex items-center gap-1.5">
        {box("minHeightFt", "Ft", 8)}
        {box("minHeightIn", "In", 11)}
        <span className="shrink-0 px-0.5 text-xs text-ink-900/40">to</span>
        {box("maxHeightFt", "Ft", 8)}
        {box("maxHeightIn", "In", 11)}
      </div>
    </div>
  );
}
