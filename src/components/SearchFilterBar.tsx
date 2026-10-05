"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { HeightRangeFilter } from "@/components/HeightRangeFilter";
import { FilterSelect, FilterToggle, RangePair } from "@/components/FilterControls";
import {
  CASTE_OPTIONS,
  GENDER_OPTIONS,
  PROFESSION_CATEGORIES,
  TAG_OPTIONS,
} from "@/lib/constants";

/** Filters mirror the search tab of the intake spreadsheet. */
export function SearchFilterBar() {
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

  const hasFilters = Array.from(searchParams.keys()).some((k) => k !== "client");

  function clearAll() {
    const params = new URLSearchParams();
    // Keep the client we are searching on behalf of.
    const client = searchParams.get("client");
    if (client) params.set("client", client);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gold-400/25 bg-white/60 p-4">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-900/40"
        />
        <Input
          placeholder="Name of the person we are searching for…"
          defaultValue={searchParams.get("search") ?? ""}
          onChange={(e) => onDebouncedChange("search", e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FilterSelect
          label="Looking for"
          value={searchParams.get("gender") ?? ""}
          placeholder="All"
          options={GENDER_OPTIONS}
          onChange={(v) => setParam("gender", v)}
        />
        <FilterSelect
          label="Caste"
          value={searchParams.get("caste") ?? ""}
          placeholder="All caste"
          options={CASTE_OPTIONS}
          onChange={(v) => setParam("caste", v)}
        />
        <FilterSelect
          label="Job"
          value={searchParams.get("professionCategory") ?? ""}
          placeholder="Any job"
          options={PROFESSION_CATEGORIES}
          onChange={(v) => setParam("professionCategory", v)}
        />
        <FilterSelect
          label="Tag"
          value={searchParams.get("tag") ?? ""}
          placeholder="Any tag"
          options={TAG_OPTIONS}
          onChange={(v) => setParam("tag", v)}
        />
        <RangePair
          label="Age (years)"
          minKey="minAge"
          maxKey="maxAge"
          minValue={searchParams.get("minAge") ?? ""}
          maxValue={searchParams.get("maxAge") ?? ""}
          onChange={onDebouncedChange}
        />
        <HeightRangeFilter
          values={{
            minHeightFt: searchParams.get("minHeightFt") ?? "",
            minHeightIn: searchParams.get("minHeightIn") ?? "",
            maxHeightFt: searchParams.get("maxHeightFt") ?? "",
            maxHeightIn: searchParams.get("maxHeightIn") ?? "",
          }}
          onChange={onDebouncedChange}
        />
        <RangePair
          label="Finances (INR)"
          minKey="minFinances"
          maxKey="maxFinances"
          minValue={searchParams.get("minFinances") ?? ""}
          maxValue={searchParams.get("maxFinances") ?? ""}
          onChange={onDebouncedChange}
        />
        <div className="flex flex-col gap-2">
          <FilterToggle
            label="Urgent only"
            checked={searchParams.get("urgent") === "1"}
            onChange={(on) => setParam("urgent", on ? "1" : "")}
          />
          <FilterToggle
            label="Potential clients"
            hint="Has a sibling we could take on"
            checked={searchParams.get("potentialClient") === "1"}
            onChange={(on) => setParam("potentialClient", on ? "1" : "")}
          />
        </div>
      </div>

      {hasFilters && (
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
            <X size={14} /> Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
