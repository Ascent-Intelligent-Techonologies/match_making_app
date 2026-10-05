"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Pause, Play, Presentation, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface SlideshowProfile {
  id: string;
  full_name: string;
  /** A line of context under the name, e.g. "28 yrs · Hyderabad". */
  subtitle?: string;
  coverUrl?: string;
}

const ADVANCE_MS = 4000;

/**
 * Full-screen run through whatever the current filters returned.
 *
 * It shows the results in the order they are on screen, so what the slideshow
 * walks through is exactly what was searched for. Autoplay starts on open
 * because that is the point of asking for a slideshow, and any manual
 * navigation pauses it so it stops fighting the person using it.
 */
export function ProfileSlideshow({
  profiles,
  onClose,
}: {
  profiles: SlideshowProfile[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const count = profiles.length;

  const go = useCallback(
    (delta: number, manual = false) => {
      if (manual) setPlaying(false);
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Profile slideshow"
      className="fixed inset-0 z-50 flex flex-col bg-ink-900/95 p-4 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-3 text-white/80">
        <span className="text-sm">
          {index + 1} of {count}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pause" : "Play"}
            className="cursor-pointer rounded-full p-2 hover:bg-white/10"
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close slideshow"
            className="cursor-pointer rounded-full p-2 hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => go(-1, true)}
          aria-label="Previous profile"
          className="shrink-0 cursor-pointer rounded-full p-2 text-white/70 hover:bg-white/10 sm:p-3"
        >
          <ChevronLeft size={28} />
        </button>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
          <div className="flex min-h-0 w-full flex-1 items-center justify-center">
            {current.coverUrl ? (
              // Signed URLs expire hourly, so these stay plain <img> rather
              // than going through the next/image cache.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.coverUrl}
                alt={current.full_name}
                className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
              />
            ) : (
              <span className="flex h-64 w-64 items-center justify-center rounded-2xl bg-white/10 text-white/40">
                <ImageOff size={40} strokeWidth={1.25} />
              </span>
            )}
          </div>

          <div className="text-center">
            <p className="font-serif text-2xl font-semibold text-white">
              {current.full_name}
            </p>
            {current.subtitle && (
              <p className="text-sm text-white/60">{current.subtitle}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => go(1, true)}
          aria-label="Next profile"
          className="shrink-0 cursor-pointer rounded-full p-2 text-white/70 hover:bg-white/10 sm:p-3"
        >
          <ChevronRight size={28} />
        </button>
      </div>
    </div>
  );
}

/** The button that opens it, with the slideshow state kept alongside. */
export function SlideshowButton({ profiles }: { profiles: SlideshowProfile[] }) {
  const [open, setOpen] = useState(false);
  if (profiles.length === 0) return null;

  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Presentation size={14} /> Slideshow ({profiles.length})
      </Button>
      {open && <ProfileSlideshow profiles={profiles} onClose={() => setOpen(false)} />}
    </>
  );
}
