"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef } from "react";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui/Field";
import {
  RELIGIONS,
  DIET_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  MANGLIK_OPTIONS,
  GENDER_OPTIONS,
} from "@/lib/constants";

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

  function onSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setParam("search", value), 350);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gold-400/25 bg-white/60 p-4">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-900/40" />
        <Input
          placeholder="Search by name, city, profession, religion…"
          defaultValue={searchParams.get("search") ?? ""}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Select
          defaultValue={searchParams.get("gender") ?? ""}
          onChange={(e) => setParam("gender", e.target.value)}
        >
          <option value="">All</option>
          {GENDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        <Select
          defaultValue={searchParams.get("religion") ?? ""}
          onChange={(e) => setParam("religion", e.target.value)}
        >
          <option value="">Any religion</option>
          {RELIGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>

        <Select
          defaultValue={searchParams.get("maritalStatus") ?? ""}
          onChange={(e) => setParam("maritalStatus", e.target.value)}
        >
          <option value="">Any marital status</option>
          {MARITAL_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        <Select
          defaultValue={searchParams.get("diet") ?? ""}
          onChange={(e) => setParam("diet", e.target.value)}
        >
          <option value="">Any diet</option>
          {DIET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        <Select
          defaultValue={searchParams.get("manglik") ?? ""}
          onChange={(e) => setParam("manglik", e.target.value)}
        >
          <option value="">Any manglik status</option>
          {MANGLIK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        <Input
          type="number"
          placeholder="Min age"
          defaultValue={searchParams.get("minAge") ?? ""}
          onChange={(e) => setParam("minAge", e.target.value)}
        />
        <Input
          type="number"
          placeholder="Max age"
          defaultValue={searchParams.get("maxAge") ?? ""}
          onChange={(e) => setParam("maxAge", e.target.value)}
        />
      </div>
    </div>
  );
}
