"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { HeightRangeFilter } from "@/components/HeightRangeFilter";
import {
  FilterCheckboxGroup,
  FilterSelect,
  FilterToggle,
  RangePair,
} from "@/components/FilterControls";
import {
  CASTE_OPTIONS,
  GENDER_OPTIONS,
  PROFESSION_CATEGORIES,
  TAG_OPTIONS,
} from "@/lib/constants";

/**
 * All Profiles filters.
 *
 * Everything is on screen at once. Boy/girl used to gate the year list, which
 * meant the only way to see a filter was to commit to a prior one; now the
 * year list simply covers whatever is on the books and nothing is hidden.
 */
export function ProfilesFilterBar({ birthYears }: { birthYears: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const get = (key: string) => searchParams.get(key) ?? "";

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
          placeholder="Search by name, city or profession…"
          defaultValue={get("search")}
          onChange={(e) => onDebouncedChange("search", e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FilterSelect
          label="Boy or girl"
          value={get("gender")}
          placeholder="All profiles"
          options={GENDER_OPTIONS}
          onChange={(v) => setParam("gender", v)}
        />
        <FilterSelect
          label="Year of birth"
          value={get("birthYear")}
          placeholder="Any year"
          options={birthYears.map(String)}
          onChange={(v) => setParam("birthYear", v)}
        />
        <FilterSelect
          label="Caste"
          value={get("caste")}
          placeholder="All caste"
          options={CASTE_OPTIONS}
          onChange={(v) => setParam("caste", v)}
        />
        <FilterSelect
          label="Job"
          value={get("professionCategory")}
          placeholder="Any job"
          options={PROFESSION_CATEGORIES}
          onChange={(v) => setParam("professionCategory", v)}
        />
        <FilterCheckboxGroup
          label="Anurupa tag"
          options={TAG_OPTIONS}
          selected={get("tags").split(",").filter(Boolean)}
          onChange={(next) => setParam("tags", next.join(","))}
        />
        <RangePair
          label="Age (years)"
          minKey="minAge"
          maxKey="maxAge"
          minValue={get("minAge")}
          maxValue={get("maxAge")}
          onChange={onDebouncedChange}
        />
        <HeightRangeFilter
          values={{
            minHeightFt: get("minHeightFt"),
            minHeightIn: get("minHeightIn"),
            maxHeightFt: get("maxHeightFt"),
            maxHeightIn: get("maxHeightIn"),
          }}
          onChange={onDebouncedChange}
        />
        <RangePair
          label="Finances (INR)"
          minKey="minFinances"
          maxKey="maxFinances"
          minValue={get("minFinances")}
          maxValue={get("maxFinances")}
          onChange={onDebouncedChange}
        />
        <div className="flex flex-col gap-2">
          <FilterToggle
            label="Urgent only"
            checked={get("urgent") === "1"}
            onChange={(on) => setParam("urgent", on ? "1" : "")}
          />
          <FilterToggle
            label="Potential clients"
            hint="Has a sibling we could take on"
            checked={get("potentialClient") === "1"}
            onChange={(on) => setParam("potentialClient", on ? "1" : "")}
          />
          <FilterToggle
            label="Anurupa Aura"
            checked={get("anurupaAura") === "1"}
            onChange={(on) => setParam("anurupaAura", on ? "1" : "")}
          />
        </div>
      </div>

      {hasFilters && (
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="ghost" onClick={() => router.push(pathname)}>
            <X size={14} /> Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
