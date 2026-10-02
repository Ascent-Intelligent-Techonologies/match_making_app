"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef } from "react";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CASTE_OPTIONS, GENDER_OPTIONS } from "@/lib/constants";

function RangePair({
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
      <span className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
        {label}
      </span>
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
 * Public-facing filters, mirroring the search tab of the intake spreadsheet:
 * name, age range, height range, caste and finances range. The internal tag
 * stays admin-only and is deliberately not offered here.
 */
export function PublicSearchFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  function onDebouncedChange(key: string, value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setParam(key, value), 350);
  }

  const hasFilters = Array.from(searchParams.keys()).length > 0;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gold-400/25 bg-white/60 p-4">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-900/40"
        />
        <Input
          placeholder="Name of the person you are searching for…"
          defaultValue={searchParams.get("search") ?? ""}
          onChange={(e) => onDebouncedChange("search", e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
            Looking for
          </span>
          <Select
            defaultValue={searchParams.get("gender") ?? ""}
            onChange={(e) => setParam("gender", e.target.value)}
          >
            <option value="">All profiles</option>
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
            Caste
          </span>
          <Select
            defaultValue={searchParams.get("caste") ?? ""}
            onChange={(e) => setParam("caste", e.target.value)}
          >
            <option value="">All caste</option>
            {CASTE_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <RangePair
          label="Age (years)"
          minKey="minAge"
          maxKey="maxAge"
          minValue={searchParams.get("minAge") ?? ""}
          maxValue={searchParams.get("maxAge") ?? ""}
          onChange={onDebouncedChange}
        />
        <RangePair
          label="Height (cm)"
          minKey="minHeight"
          maxKey="maxHeight"
          minValue={searchParams.get("minHeight") ?? ""}
          maxValue={searchParams.get("maxHeight") ?? ""}
          onChange={onDebouncedChange}
        />
        {/* Finances filter — remove this block to stop clients filtering on a
            figure they are never shown. See note in the handover. */}
        <RangePair
          label="Finances (INR)"
          minKey="minFinances"
          maxKey="maxFinances"
          minValue={searchParams.get("minFinances") ?? ""}
          maxValue={searchParams.get("maxFinances") ?? ""}
          onChange={onDebouncedChange}
        />
      </div>

      {hasFilters && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => router.push(pathname)}
          >
            <X size={14} /> Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
