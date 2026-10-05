"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  ImageOff,
  Pause,
  Play,
  Presentation,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface SlideshowDetail {
  label: string;
  value: string;
}

export interface SlideshowProfile {
  id: string;
  full_name: string;
  /** One line under the name, e.g. "28 yrs · Hyderabad". */
  subtitle?: string;
  /** Short pills: caste, height, job. */
  badges?: string[];
  /** The labelled rows in the details panel. */
  details?: SlideshowDetail[];
  /** Longer free text, e.g. what they are looking for. */
  note?: { label: string; value: string };
  coverUrl?: string;
  /** Where "View full profile" goes. Omitted means no link. */
  href?: string;
  favorite?: boolean;
}

const ADVANCE_MS = 6000;

/**
 * Full-screen run through whatever the current filters returned.
 *
 * Built as a card on a dimmed backdrop rather than a bare photo: a photo alone
 * fills the screen with no edge, which reads as "no controls" even when they
 * are there. The frame gives the controls somewhere to sit, and the panel
 * beside the photo carries the details that make a profile worth stopping on.
 *
 * It walks the results in the order they are on screen, so what it shows is
 * exactly what was searched for. Autoplay starts on open, and any manual
 * navigation pauses it so it stops fighting whoever is driving.
 */
export function ProfileSlideshow({
  profiles,
  onToggleFavorite,
  onClose,
}: {
  profiles: SlideshowProfile[];
  /** Omitted when there is nobody to attribute a favourite to. */
  onToggleFavorite?: (
    profileId: string
  ) => Promise<{ shortlisted?: boolean; error?: string }>;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [favorites, setFavorites] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(profiles.map((p) => [p.id, Boolean(p.favorite)]))
  );
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const count = profiles.length;

  const go = useCallback(
    (delta: number, manual = false) => {
      if (manual) setPlaying(false);
      setFavoriteError(null);
      setIndex((i) => (i + delta + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (!playing || count < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), ADVANCE_MS);
    return () => clearInterval(timer);
  }, [playing, count]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1, true);
      if (e.key === "ArrowLeft") go(-1, true);
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    // The page behind must not scroll while the slideshow is over it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [go, onClose]);

  if (count === 0) return null;
  const current = profiles[index];
  const isFavorite = favorites[current.id] ?? false;

  async function toggleFavorite() {
    if (!onToggleFavorite || savingFavorite) return;
    // Stop the carousel moving on before the tap has been recorded.
    setPlaying(false);
    setSavingFavorite(true);
    setFavoriteError(null);

    const id = current.id;
    const optimistic = !isFavorite;
    setFavorites((f) => ({ ...f, [id]: optimistic }));

    try {
      const result = await onToggleFavorite(id);
      if (result.error) {
        setFavorites((f) => ({ ...f, [id]: !optimistic }));
        setFavoriteError(result.error);
      } else if (typeof result.shortlisted === "boolean") {
        setFavorites((f) => ({ ...f, [id]: result.shortlisted as boolean }));
      }
    } catch {
      setFavorites((f) => ({ ...f, [id]: !optimistic }));
      setFavoriteError("Could not save that. Please try again.");
    } finally {
      setSavingFavorite(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Profile slideshow"
      className="fixed inset-0 z-50 flex flex-col gap-3 bg-ink-900/90 p-3 backdrop-blur-md sm:gap-4 sm:p-6"
    >
      {/* Top bar. Controls sit on solid chips so they read as controls rather
          than as marks on the photo. */}
      <div className="mx-auto flex w-full max-w-5xl shrink-0 items-center justify-between gap-3">
        <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white">
          {index + 1} <span className="text-white/60">of {count}</span>
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/25"
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
            <span className="hidden sm:inline">{playing ? "Pause" : "Play"}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close slideshow"
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/25"
          >
            <X size={16} />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>
      </div>

      {/* The card. */}
      <div className="mx-auto flex w-full min-h-0 max-w-5xl flex-1 overflow-hidden rounded-3xl bg-blush-50 shadow-2xl">
        {/* Side by side only from 1024px. A portrait tablet is wide enough for
            two columns on paper, but it squeezes the photo into a tall strip
            that crops faces badly, so it stacks like a phone instead. */}
        <div className="flex min-h-0 w-full flex-col lg:flex-row">
          {/* Photo, with the arrows anchored to it. */}
          <div className="relative min-h-0 shrink-0 basis-[38%] bg-blush-200 sm:basis-[45%] lg:basis-[55%]">
            {current.coverUrl ? (
              // Signed URLs expire hourly, so this stays a plain <img> rather
              // than going through the next/image cache.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.coverUrl}
                alt={current.full_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-maroon-700/30">
                <ImageOff size={48} strokeWidth={1.25} />
              </span>
            )}

            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1, true)}
                  aria-label="Previous profile"
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-ink-900/55 text-white shadow-lg backdrop-blur-sm hover:bg-ink-900/75"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => go(1, true)}
                  aria-label="Next profile"
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-ink-900/55 text-white shadow-lg backdrop-blur-sm hover:bg-ink-900/75"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}

            {/* Autoplay progress. Keyed on the index so it restarts each slide,
                and only rendered while playing so a pause does not leave a bar
                frozen mid-way pretending to be loading. */}
            {playing && count > 1 && (
              <div className="absolute inset-x-0 bottom-0 h-1 bg-ink-900/20">
                <div
                  key={index}
                  className="h-full bg-maroon-600"
                  style={{ animation: `slideshow-progress ${ADVANCE_MS}ms linear forwards` }}
                />
              </div>
            )}
          </div>

          {/* Details. */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5 sm:p-6">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-maroon-700 sm:text-3xl">
                {current.full_name}
              </h2>
              {current.subtitle && (
                <p className="text-sm text-ink-900/60">{current.subtitle}</p>
              )}
            </div>

            {current.badges && current.badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {current.badges.map((b) => (
                  <span
                    key={b}
                    className="rounded-full bg-maroon-600/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-maroon-700 ring-1 ring-maroon-600/20"
                  >
                    {b}
                  </span>
                ))}
              </div>
            )}

            {current.details && current.details.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                {current.details.map((d) => (
                  <div key={d.label} className="flex flex-col gap-0.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-maroon-700/60">
                      {d.label}
                    </dt>
                    <dd className="text-sm text-ink-900">{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {current.note?.value && (
              <div className="flex flex-col gap-0.5 rounded-xl bg-white/70 p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-maroon-700/60">
                  {current.note.label}
                </span>
                <p className="whitespace-pre-wrap text-sm text-ink-900/80">
                  {current.note.value}
                </p>
              </div>
            )}

            {/* Sticky, so the heart is reachable without scrolling to the
                bottom of a long profile on a phone. */}
            <div className="sticky bottom-0 -mx-5 mt-1 flex flex-col gap-2 border-t border-blush-200 bg-blush-50 px-5 pb-1 pt-4 sm:-mx-6 sm:px-6 lg:mt-auto">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {onToggleFavorite && (
                  <Button
                    type="button"
                    variant={isFavorite ? "primary" : "secondary"}
                    onClick={toggleFavorite}
                    disabled={savingFavorite}
                    aria-pressed={isFavorite}
                    className="w-full sm:w-auto"
                  >
                    <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
                    {isFavorite ? "Shortlisted" : "Add to shortlist"}
                  </Button>
                )}
                {current.href && (
                  <Link
                    href={current.href}
                    className="inline-flex w-full items-center justify-center rounded-full border border-gold-400 px-5 py-2.5 text-sm font-medium text-maroon-700 hover:bg-blush-100 sm:w-auto"
                  >
                    View full profile
                  </Link>
                )}
              </div>
              {favoriteError && (
                <p className="text-xs text-red-700">{favoriteError}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Jump straight to any slide. Dots only while the count stays scannable. */}
      {count > 1 && count <= 20 && (
        <div className="mx-auto flex w-full max-w-5xl shrink-0 flex-wrap items-center justify-center gap-1.5">
          {profiles.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPlaying(false);
                setIndex(i);
              }}
              aria-label={`Go to ${p.full_name}`}
              aria-current={i === index}
              className={`h-2 cursor-pointer rounded-full transition-all ${
                i === index ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}

      <style>{`@keyframes slideshow-progress { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}

/** The button that opens it, with the slideshow state kept alongside. */
export function SlideshowButton({
  profiles,
  onToggleFavorite,
}: {
  profiles: SlideshowProfile[];
  onToggleFavorite?: (
    profileId: string
  ) => Promise<{ shortlisted?: boolean; error?: string }>;
}) {
  const [open, setOpen] = useState(false);
  if (profiles.length === 0) return null;

  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Presentation size={14} /> Slideshow ({profiles.length})
      </Button>
      {open && (
        <ProfileSlideshow
          profiles={profiles}
          onToggleFavorite={onToggleFavorite}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
