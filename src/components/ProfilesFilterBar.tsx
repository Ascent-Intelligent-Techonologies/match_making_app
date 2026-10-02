"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef } from "react";
import { Search, X } from "lucide-react";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { GENDER_OPTIONS } from "@/lib/constants";

/**
 * All Profiles filters: pick boy or girl first, then narrow by birth year.
 * The year list is built from the profiles actually on the books, so it only
 * ever offers years that will return something.
 */
export function ProfilesFilterBar({ birthYears }: { birthYears: number[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gender = searchParams.get("gender") ?? "";

  function setParam(key: string, value: string, clear: string[] = []) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    clear.forEach((k) => params.delete(k));
    router.push(`${pathname}?${params.toString()}`);
  }

  function onSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setParam("search", value), 350);
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
          defaultValue={searchParams.get("search") ?? ""}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
            Boy or girl
          </span>
          <Select
            value={gender}
            // Changing who we are looking at invalidates the year chosen for the
            // previous list, so it is cleared rather than left stale.
            onChange={(e) => setParam("gender", e.target.value, ["birthYear"])}
          >
            <option value="">All profiles</option>
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        {gender && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
              Year of birth
            </span>
            <Select
              value={searchParams.get("birthYear") ?? ""}
              onChange={(e) => setParam("birthYear", e.target.value)}
            >
              <option value="">Any year</option>
              {birthYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        )}
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
