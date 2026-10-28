"use client";

import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/Field";
import { formatClientPhone } from "@/lib/format";
import type { ClientOption } from "@/components/ShareLinkCreator";

/**
 * A client box you can type into: finds clients by name or phone number as you
 * type, so finding one among thousands is a few letters rather than a scroll.
 * Shared by the Search page and the share-link form.
 *
 * The matching happens on the server (see the lookup route), because there is a
 * client for every profile on file and sending them all to every page would
 * make each page slower for the sake of a box most visits never use.
 */

interface Lookup {
  /** The text these results are for. */
  for: string;
  clients: ClientOption[];
  more: boolean;
  failed: boolean;
}

export function ClientPicker({
  id,
  onSelect,
  placeholder = "Type a name or number…",
  clearOnSelect = false,
  disabled,
}: {
  id: string;
  onSelect: (client: ClientOption) => void;
  placeholder?: string;
  /** Empty the box after a pick, for forms that copy the client's details elsewhere. */
  clearOnSelect?: boolean;
  disabled?: boolean;
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
        const failed = { for: query, clients: [], more: false, failed: true };
        try {
          const response = await fetch(`/admin/clients/lookup?q=${encodeURIComponent(query)}`, {
            signal: controller.signal,
          });
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
  }, [open, query]);

  // Until the answer for the current text arrives, keep showing the last one
  // rather than blanking the list on every keystroke.
  const waiting = lookup === null || lookup.for !== query;
  const shown = lookup?.clients ?? [];
  const activeIndex = Math.min(active, Math.max(shown.length - 1, 0));

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, listId]);

  function choose(client: ClientOption) {
    setQuery(clearOnSelect ? "" : client.full_name);
    setOpen(false);
    onSelect(client);
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
      // Enter must pick a client, not submit whatever form the picker sits in.
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
        placeholder={placeholder}
        disabled={disabled}
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
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-blush-300 bg-white py-1 shadow-lg"
        >
          {shown.map((client, i) => (
            <li
              key={client.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              // Pressing an option must not blur the box first, or the list
              // would close before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(client)}
              onMouseMove={() => i !== activeIndex && setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3.5 py-2 text-[15px] ${
                i === activeIndex ? "bg-blush-100" : ""
              } ${waiting ? "opacity-60" : ""}`}
            >
              <span className="min-w-0 truncate text-ink-900">{client.full_name}</span>
              <span className="shrink-0 text-xs text-ink-900/50">
                {formatClientPhone(client) ?? "No number"}
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
              No client matches “{query.trim()}”.
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
