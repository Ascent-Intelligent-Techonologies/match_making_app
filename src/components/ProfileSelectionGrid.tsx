"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Share2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ShareLinkCreator, type ClientOption } from "@/components/ShareLinkCreator";
import { SlideshowButton } from "@/components/ProfileSlideshow";
import {
  calculateAge,
  formatDate,
  formatHeight,
  formatInrCompact,
  formatLocation,
} from "@/lib/format";

export interface SelectableProfile {
  id: string;
  full_name: string;
  dob: string | null;
  is_active: boolean;
  profession: string | null;
  native_place: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  religion: string | null;
  caste: string | null;
  height_cm: number | null;
  annual_income_inr: number | null;
  coverUrl?: string;
}


/** The basics a slide shows, in one place so every view agrees on them. */
function slideDetails(p: {
  height_cm?: number | null;
  profession?: string | null;
  native_place?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}) {
  return [
    { label: "Height", value: p.height_cm ? formatHeight(p.height_cm) : null },
    { label: "Occupation", value: p.profession ?? null },
    { label: "Native place", value: p.native_place ?? null },
    { label: "Current location", value: formatLocation(p) },
  ].filter((d): d is { label: string; value: string } => Boolean(d.value));
}

/** A labelled line on a card. Renders nothing when there is no value. */
function CardDetail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-maroon-700/55">
        {label}
      </dt>
      <dd className="text-sm leading-snug text-ink-900">{value}</dd>
    </div>
  );
}

export function ProfileSelectionGrid({
  profiles,
  defaultExpiryDays,
  existingClients = [],
}: {
  profiles: SelectableProfile[];
  defaultExpiryDays: number;
  existingClients?: ClientOption[];
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shareOpen, setShareOpen] = useState(false);

  // Selection is always intersected with what the current filters show, so
  // "3 selected" can never mean profiles the admin can't see on screen.
  const selectedVisible = useMemo(
    () => profiles.filter((p) => selectedIds.has(p.id)),
    [profiles, selectedIds]
  );
  const selectedVisibleIds = useMemo(
    () => selectedVisible.map((p) => p.id),
    [selectedVisible]
  );

  const allSelected = profiles.length > 0 && selectedVisible.length === profiles.length;
  const someSelected = selectedVisible.length > 0 && !allSelected;

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
      if (allSelected) profiles.forEach((p) => next.delete(p.id));
      else profiles.forEach((p) => next.add(p.id));
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setShareOpen(false);
  }

  if (profiles.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gold-400/40 bg-white/40 p-10 text-center text-sm text-ink-900/50">
        No profiles match these filters yet.
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
              if (el) el.indeterminate = someSelected;
            }}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-blush-300 text-maroon-600 focus:ring-maroon-600"
          />
          <span>
            Select all {profiles.length} filtered profile{profiles.length === 1 ? "" : "s"}
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {/* No favourite here: All Profiles is not scoped to a client, so a
              shortlist would have nobody to belong to. */}
          <SlideshowButton
            profiles={profiles.map((p) => ({
              id: p.id,
              full_name: p.full_name,
              subtitle: [
                p.dob ? formatDate(p.dob) : null,
                calculateAge(p.dob) ? `${calculateAge(p.dob)} yrs` : null,
              ]
                .filter(Boolean)
                .join(" · "),
              details: slideDetails(p),
              coverUrl: p.coverUrl,
            }))}
          />
          <span className="text-sm text-ink-900/60">
            {selectedVisible.length} selected
          </span>
          {selectedVisible.length > 0 && (
            <Button type="button" size="sm" variant="ghost" onClick={clearSelection}>
              <X size={14} /> Clear
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={selectedVisible.length === 0}
            onClick={() => setShareOpen((v) => !v)}
          >
            <Share2 size={14} />
            {shareOpen ? "Hide share panel" : `Share ${selectedVisible.length || ""} in one link`.trim()}
          </Button>
        </div>
      </div>

      {shareOpen && selectedVisible.length > 0 && (
        <ShareLinkCreator
          allProfiles={selectedVisible.map((p) => ({
            id: p.id,
            full_name: p.full_name,
            city: p.city,
          }))}
          preselectedIds={selectedVisibleIds}
          defaultExpiryDays={defaultExpiryDays}
          existingClients={existingClients}
          lockSelection
        />
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((profile) => {
          const age = calculateAge(profile.dob);
          const checked = selectedIds.has(profile.id);
          return (
            <div key={profile.id} className="relative">
              {/* Sibling of the link, stacked above it, so ticking never navigates. */}
              <label
                className="absolute left-3 top-3 z-10 flex cursor-pointer items-center rounded-lg bg-white/90 p-2 shadow-sm ring-1 ring-gold-400/30 backdrop-blur-sm"
                title={checked ? "Deselect profile" : "Select profile"}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggleOne(profile.id, e.target.checked)}
                  aria-label={`Select ${profile.full_name}`}
                  className="h-4 w-4 rounded border-blush-300 text-maroon-600 focus:ring-maroon-600"
                />
              </label>

              <Link href={`/admin/profiles/${profile.id}`}>
                <Card
                  className={`overflow-hidden transition-transform hover:-translate-y-0.5 ${
                    checked ? "ring-2 ring-maroon-600" : ""
                  }`}
                >
                  <div className="relative aspect-[4/3] bg-blush-100">
                    {profile.coverUrl && (
                      <Image
                        src={profile.coverUrl}
                        alt={profile.full_name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="flex flex-col gap-3 p-4">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="font-serif text-lg font-semibold text-maroon-700">
                          {profile.full_name}
                        </h2>
                        {!profile.is_active && <Badge tone="neutral">Inactive</Badge>}
                      </div>
                      <p className="text-sm text-ink-900/60">
                        {profile.dob ? formatDate(profile.dob) : "DOB —"}
                        {age ? ` · ${age} yrs` : ""}
                      </p>
                    </div>

                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
                      <CardDetail
                        label="Height"
                        value={profile.height_cm ? formatHeight(profile.height_cm) : null}
                      />
                      <CardDetail label="Occupation" value={profile.profession} />
                      <CardDetail label="Native place" value={profile.native_place} />
                      <CardDetail
                        label="Current location"
                        value={formatLocation(profile)}
                      />
                    </dl>

                    <div className="flex flex-wrap gap-1.5">
                      {profile.caste && <Badge tone="gold">{profile.caste}</Badge>}
                      {profile.religion && <Badge tone="gold">{profile.religion}</Badge>}
                      {profile.annual_income_inr && (
                        <Badge tone="maroon">{formatInrCompact(profile.annual_income_inr)}</Badge>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
