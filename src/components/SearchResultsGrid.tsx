"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, ImageOff, Pencil, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ShareLinkCreator } from "@/components/ShareLinkCreator";
import { SlideshowButton } from "@/components/ProfileSlideshow";
import { calculateAge, formatDate, formatHeight } from "@/lib/format";

export interface SearchResult {
  id: string;
  full_name: string;
  surname: string | null;
  dob: string | null;
  height_cm: number | null;
  caste: string | null;
  sub_caste: string | null;
  requirements: string | null;
  /** Internal priority flag; shown as a badge to the admin only. */
  urgent: boolean;
  coverUrl?: string;
  /** Already sent to this client in an earlier link — shown greyed out. */
  alreadyShared: boolean;
  /** This client hearted it on a share page. */
  shortlisted: boolean;
}

export function SearchResultsGrid({
  results,
  client,
  defaultExpiryDays,
}: {
  results: SearchResult[];
  client: { id: string; full_name: string; phone: string };
  defaultExpiryDays: number;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shareOpen, setShareOpen] = useState(false);

  const selected = useMemo(
    () => results.filter((r) => selectedIds.has(r.id)),
    [results, selectedIds]
  );
  const selectedIdList = useMemo(() => selected.map((r) => r.id), [selected]);
  const allSelected = results.length > 0 && selected.length === results.length;

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) results.forEach((r) => next.delete(r.id));
      else results.forEach((r) => next.add(r.id));
      return next;
    });
  }

  if (results.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gold-400/40 bg-white/40 p-10 text-center text-sm text-ink-900/50">
        No profiles match these filters.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-gold-400/25 bg-white/60 p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-maroon-700">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = selected.length > 0 && !allSelected;
            }}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-blush-300 text-maroon-600 focus:ring-maroon-600"
          />
          <span>Select all {results.length} result{results.length === 1 ? "" : "s"}</span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {/* Runs through the results in the order they appear below, so the
              slideshow shows exactly what was searched for. */}
          <SlideshowButton
            profiles={results.map((r) => ({
              id: r.id,
              full_name: [r.full_name, r.surname].filter(Boolean).join(" "),
              subtitle: [
                calculateAge(r.dob) ? `${calculateAge(r.dob)} yrs` : null,
                r.height_cm ? formatHeight(r.height_cm) : null,
                r.caste,
              ]
                .filter(Boolean)
                .join(" · "),
              coverUrl: r.coverUrl,
            }))}
          />
          <span className="text-sm text-ink-900/60">{selected.length} selected</span>
          {selected.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedIds(new Set());
                setShareOpen(false);
              }}
            >
              <X size={14} /> Clear
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={selected.length === 0}
            onClick={() => setShareOpen((v) => !v)}
          >
            <Share2 size={14} />
            {shareOpen ? "Hide share panel" : `Share ${selected.length || ""}`.trim()}
          </Button>
        </div>
      </div>

      {shareOpen && selected.length > 0 && (
        <ShareLinkCreator
          allProfiles={selected.map((r) => ({
            id: r.id,
            full_name: r.full_name,
            city: null,
          }))}
          preselectedIds={selectedIdList}
          defaultExpiryDays={defaultExpiryDays}
          fixedClient={{ full_name: client.full_name, phone: client.phone }}
          lockSelection
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {results.map((r) => {
          const checked = selectedIds.has(r.id);
          const age = calculateAge(r.dob);
          return (
            <Card
              key={r.id}
              className={`flex gap-4 p-4 transition-colors ${
                r.alreadyShared ? "bg-ink-900/5 opacity-60" : ""
              } ${checked ? "ring-2 ring-maroon-600" : ""}`}
            >
              <label className="flex cursor-pointer items-start pt-1">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggleOne(r.id, e.target.checked)}
                  aria-label={`Select ${r.full_name}`}
                  className="h-4 w-4 rounded border-blush-300 text-maroon-600 focus:ring-maroon-600"
                />
              </label>

              <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-blush-100">
                {r.coverUrl ? (
                  <Image src={r.coverUrl} alt={r.full_name} fill sizes="80px" className="object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-maroon-700/30">
                    <ImageOff size={20} strokeWidth={1.25} />
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-serif text-lg font-semibold text-maroon-700">
                    {r.full_name}
                    {r.surname ? ` ${r.surname}` : ""}
                  </h3>
                  {r.shortlisted && (
                    <Badge tone="maroon">
                      <Heart size={11} fill="currentColor" /> Liked
                    </Badge>
                  )}
                  {r.urgent && <Badge tone="danger">Urgent</Badge>}
                  {r.alreadyShared && <Badge tone="neutral">Already shared</Badge>}
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-maroon-700/60">DOB</dt>
                    <dd className="text-ink-900">
                      {formatDate(r.dob)}
                      {age ? ` · ${age} yrs` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-wider text-maroon-700/60">
                      Height
                    </dt>
                    <dd className="text-ink-900">
                      {r.height_cm ? formatHeight(r.height_cm) : "—"}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[11px] uppercase tracking-wider text-maroon-700/60">
                      Caste
                    </dt>
                    <dd className="text-ink-900">
                      {r.caste ?? "—"}
                      {r.sub_caste ? ` · ${r.sub_caste}` : ""}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[11px] uppercase tracking-wider text-maroon-700/60">
                      Requirements
                    </dt>
                    <dd className="text-ink-900">{r.requirements ?? "—"}</dd>
                  </div>
                </dl>

                <Link
                  href={`/admin/profiles/${r.id}`}
                  className="mt-1 inline-flex w-fit items-center gap-1.5 text-xs font-medium text-maroon-700 hover:underline"
                >
                  <Pencil size={12} /> View / edit all details
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
