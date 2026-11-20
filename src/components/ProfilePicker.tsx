"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { describeProfile, fullName, type MatchProfile, type MatchSide } from "@/lib/client-match";

interface Lookup {
  /** The text these results are for. */
  for: string;
  profiles: MatchProfile[];
  more: boolean;
  failed: boolean;
}

/**
 * A box for finding one boy's or one girl's profile by typing part of a name or
 * a phone number, and showing who was picked once they have been.
 *
 * Matching happens on the server (see the profiles lookup route) because there
 * are thousands of profiles, and sending them all to the page for a box most
 * visits never use would slow every visit down.
 */
export function ProfilePicker({
  id,
  side,
  value,
  onChange,
}: {
  id: string;
  side: MatchSide;
  value: MatchProfile | null;
  onChange: (profile: MatchProfile | null) => void;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [lookup, setLookup] = useState<Lookup | null>(null);

  // Ask for matches whenever the box is open and the text changes, after a
  // short pause so a burst of typing is one question, and dropping any answer
  // that arrives for text that has since changed.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        const failed = { for: query, profiles: [], more: false, failed: true };
        try {
          const response = await fetch(
            `/admin/profiles/lookup?side=${side}&q=${encodeURIComponent(query)}`,
            { signal: controller.signal }
          );
          // Signed out, the proxy answers with the login page: not a JSON reply.
          const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
          const body = response.ok && isJson ? await response.json() : null;
          setLookup(body ? { for: query, ...body, failed: false } : failed);
        } catch {
          if (!controller.signal.aborted) setLookup(failed);
        }
      },
      query ? 200 : 0
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, side]);

  const waiting = lookup === null || lookup.for !== query;
  const shown = lookup?.profiles ?? [];
  const activeIndex = Math.min(active, Math.max(shown.length - 1, 0));

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, listId]);

  function choose(profile: MatchProfile) {
    setQuery("");
    setOpen(false);
    onChange(profile);
  }

  // Once someone is picked, the box gives way to who it is, with a way to change.
  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-maroon-600/40 bg-blush-100 px-3.5 py-2.5">
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-maroon-700">{fullName(value)}</span>
          <span className="truncate text-xs text-ink-900/60">
            {describeProfile(value) || "No age or city on file"}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={`Change the ${side}'s profile`}
          className="shrink-0 cursor-pointer rounded-full p-1 text-maroon-700/60 hover:bg-white hover:text-maroon-700"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive(Math.min(activeIndex + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter" && open) {
      // Enter must pick someone, not submit the form the picker sits in.
      e.preventDefault();
      if (shown[activeIndex] && !waiting) choose(shown[activeIndex]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[activeIndex] ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        value={query}
        placeholder={`Search ${side === "boy" ? "boys" : "girls"} by name or number…`}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-busy={waiting}
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-blush-300 bg-white py-1 shadow-lg"
        >
          {shown.map((profile, i) => (
            <li
              key={profile.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              // Pressing an option must not blur the box first, or the list
              // would close before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(profile)}
              onMouseMove={() => i !== activeIndex && setActive(i)}
              className={`flex cursor-pointer flex-col px-3.5 py-2 ${
                i === activeIndex ? "bg-blush-100" : ""
              } ${waiting ? "opacity-60" : ""}`}
            >
              <span className="truncate text-[15px] text-ink-900">{fullName(profile)}</span>
              <span className="truncate text-xs text-ink-900/50">
                {[describeProfile(profile), profile.gender === null ? "gender not set" : null]
                  .filter(Boolean)
                  .join(" · ") || "No age or city on file"}
              </span>
            </li>
          ))}
          {waiting && (
            <li role="presentation" className="px-3.5 py-2 text-sm text-ink-900/60">
              Searching…
            </li>
          )}
          {!waiting && lookup?.failed && (
            <li role="presentation" className="px-3.5 py-2 text-sm text-red-700">
              Could not search. Check your connection and try again.
            </li>
          )}
          {!waiting && !lookup?.failed && shown.length === 0 && (
            <li role="presentation" className="px-3.5 py-2 text-sm text-ink-900/60">
              No {side === "boy" ? "boy" : "girl"} matches &ldquo;{query.trim()}&rdquo;.
            </li>
          )}
          {!waiting && lookup?.more && (
            <li role="presentation" className="px-3.5 py-2 text-xs text-ink-900/50">
              Showing the first {shown.length}. Keep typing to narrow it down.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
