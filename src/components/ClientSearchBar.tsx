"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Field";

export function ClientSearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("search", value);
      else params.delete("search");
      router.push(`${pathname}?${params.toString()}`);
    }, 350);
  }

  return (
    <div className="relative rounded-2xl border border-gold-400/25 bg-white/60 p-4">
      <Search
        size={16}
        className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-ink-900/40"
      />
      <Input
        placeholder="Search clients by name or phone number…"
        defaultValue={searchParams.get("search") ?? ""}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-10"
      />
    </div>
  );
}
