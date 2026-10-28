"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/Field";
import type { ClientOption } from "@/components/ShareLinkCreator";

/**
 * A client dropdown you can type into: matches the name or the phone number,
 * so finding one client among hundreds is a few letters rather than a scroll.
 * Shared by the Search page and the share-link form.
 */

/** Enough to scroll through; past this the list asks for more typing instead. */
const MAX_SHOWN = 50;

const digitsOf = (s: string) => s.replace(/\D/g, "");

/** Lower is better; null is no match. Names starting with the text come first. */
function rank(client: ClientOption, query: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const name = client.full_name.toLowerCase();
  if (name.startsWith(q)) return 0;
  if (name.split(/\s+/).some((word) => word.startsWith(q))) return 1;
  if (name.includes(q)) return 2;

  // A few digits are enough to look someone up by number, whatever spaces or
  // +91 the stored number carries; fewer than that would match everyone.
  const digits = digitsOf(q);
  if (digits.length >= 3 && digitsOf(client.phone_display ?? client.phone).includes(digits)) {
    return 3;
  }
  return null;
}

export function ClientPicker({
  id,
  clients,
  onSelect,
  placeholder = "Type a name or number…",
  clearOnSelect = false,
  disabled,
}: {
  id: string;
  clients: ClientOption[];
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

  const { shown, total } = useMemo(() => {
    const matched = clients
      .map((client) => ({ client, score: rank(client, query) }))
      .filter((m): m is { client: ClientOption; score: number } => m.score !== null)
      // Array.sort is stable, so equal scores stay in the list's own (name) order.
      .sort((a, b) => a.score - b.score)
      .map((m) => m.client);
    return { shown: matched.slice(0, MAX_SHOWN), total: matched.length };
  }, [clients, query]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, listId]);

  function choose(client: ClientOption) {
    setQuery(clearOnSelect ? "" : client.full_name);
    setOpen(false);
    onSelect(client);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open) {
      // Enter must pick a client, not submit whatever form the picker sits in.
      e.preventDefault();
      if (shown[active]) choose(shown[active]);
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
        aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
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
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-blush-300 bg-white py-1 shadow-lg"
        >
          {shown.map((client, i) => (
            <li
              key={client.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // Pressing an option must not blur the box first, or the list
              // would close before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(client)}
              onMouseMove={() => i !== active && setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3.5 py-2 text-[15px] ${
                i === active ? "bg-blush-100" : ""
              }`}
            >
              <span className="min-w-0 truncate text-ink-900">{client.full_name}</span>
              <span className="shrink-0 text-xs text-ink-900/50">
                {client.phone_display ?? client.phone}
              </span>
            </li>
          ))}
          {shown.length === 0 && (
            <li role="presentation" className="px-3.5 py-2 text-sm text-ink-900/60">
              No client matches “{query.trim()}”.
            </li>
          )}
          {total > shown.length && (
            <li role="presentation" className="px-3.5 py-2 text-xs text-ink-900/50">
              Showing {shown.length} of {total}. Keep typing to narrow it down.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
