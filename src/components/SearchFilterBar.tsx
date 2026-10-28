"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Check, Save, Search, X } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { PendingBar } from "@/components/PendingBar";
import { HeightRangeFilter } from "@/components/HeightRangeFilter";
import {
  FilterCheckboxGroup,
  FilterSelect,
  FilterToggle,
  RangePair,
} from "@/components/FilterControls";
import { saveSearchFiltersAction } from "@/lib/actions/clients";
import { describeActionError } from "@/lib/stale-deploy";
import { sanitizeFilters, UNFILTERED_PARAM, type SavedFilters } from "@/lib/search-filters";
import {
  CASTE_OPTIONS,
  GENDER_OPTIONS,
  PROFESSION_CATEGORIES,
  TAG_OPTIONS,
} from "@/lib/constants";

/**
 * Filters mirror the search tab of the intake spreadsheet.
 *
 * Save filters keeps what is on screen for the client being searched for, and
 * the page puts it back whenever that client's search is opened. Nothing is
 * saved until the button is pressed, so looking around never changes it.
 */
export function SearchFilterBar({
  clientId,
  clientName,
  savedFilters,
}: {
  clientId: string;
  clientName: string;
  savedFilters: SavedFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Held in a transition so the panel can show that a new list is on its way.
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // What is saved for this client. Starts as the page found it and is updated
  // here when Save succeeds, as saving does not re-render the page.
  const [savedKey, setSavedKey] = useState(() => JSON.stringify(sanitizeFilters(savedFilters)));
  // The number and text boxes are filled in once from the address, so after a
  // clear they are remounted (new key) to empty them as well.
  const [boxesKey, setBoxesKey] = useState(0);
  const [boxesToReset, setBoxesToReset] = useState(false);

  // The filters on screen, in a fixed order so they compare as text.
  const current = sanitizeFilters(Object.fromEntries(searchParams));
  const currentKey = JSON.stringify(current);
  const hasCurrent = currentKey !== "{}";
  const hasSaved = savedKey !== "{}";
  const isSaved = currentKey === savedKey;
  const hasFilters = Array.from(searchParams.keys()).some(
    (k) => k !== "client" && k !== UNFILTERED_PARAM
  );

  // Adjusting state while rendering is React's way of reacting to the address
  // changing: the clear has landed, so the boxes can start again from empty.
  if (boxesToReset && !hasFilters) {
    setBoxesToReset(false);
    setBoxesKey((k) => k + 1);
  }

  async function onSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const { error } = await saveSearchFiltersAction(clientId, current);
      if (error) setSaveError(error);
      else setSavedKey(currentKey);
    } catch (error) {
      setSaveError(describeActionError(error, "Could not save these filters."));
    } finally {
      setSaving(false);
    }
  }

  function apply(params: URLSearchParams) {
    // A new set of filters starts again from the first page.
    params.delete("page");
    // With nothing left to filter by, the address says so: a bare one means
    // "just opened", and the page would put the saved filters back.
    if (Object.keys(sanitizeFilters(Object.fromEntries(params))).length === 0) {
      params.set(UNFILTERED_PARAM, "1");
    } else {
      params.delete(UNFILTERED_PARAM);
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    apply(params);
  }

  function onDebouncedChange(key: string, value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setParam(key, value), 350);
  }

  function clearAll() {
    // A box typed into a moment ago must not put its value back after this.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setBoxesToReset(true);
    // Keep the client we are searching on behalf of.
    apply(new URLSearchParams({ client: clientId }));
  }

  const message =
    saveError ??
    (isSaved && hasSaved
      ? `Saved for ${clientName}. These come back each time you open their search.`
      : hasCurrent
        ? `Not saved yet. Press Save filters to keep these for ${clientName}.`
        : hasSaved
          ? `${clientName} has saved filters. Open their search again to bring them back, or remove them.`
          : `Set filters, then press Save filters to keep them for ${clientName}.`);

  return (
    <div
      aria-busy={isPending || saving}
      className="relative flex flex-col gap-4 rounded-2xl border border-gold-400/25 bg-white/60 p-4"
    >
      {(isPending || saving) && <PendingBar />}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p
          role="status"
          className={`text-xs ${saveError ? "text-red-700" : "text-ink-900/60"}`}
        >
          {message}
        </p>
        <div className="flex items-center gap-1">
          {(hasCurrent || hasSaved) &&
            (isSaved ? (
              <Button type="button" size="sm" variant="ghost" disabled>
                <Check size={14} /> Saved
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant={hasCurrent ? "secondary" : "ghost"}
                disabled={saving}
                onClick={onSave}
              >
                <Save size={14} /> {hasCurrent ? "Save filters" : "Remove saved filters"}
              </Button>
            ))}
          {hasFilters && (
            <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
              <X size={14} /> Clear all filters
            </Button>
          )}
        </div>
      </div>

      <div key={`search-${boxesKey}`} className="relative">
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

      <div key={`filters-${boxesKey}`} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <FilterCheckboxGroup
          label="Anurupa tag"
          options={TAG_OPTIONS}
          selected={(searchParams.get("tags") ?? "").split(",").filter(Boolean)}
          onChange={(next) => setParam("tags", next.join(","))}
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
          <FilterToggle
            label="Anurupa Aura"
            checked={searchParams.get("anurupaAura") === "1"}
            onChange={(on) => setParam("anurupaAura", on ? "1" : "")}
          />
        </div>
      </div>
    </div>
  );
}
