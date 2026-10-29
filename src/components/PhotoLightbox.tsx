"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface LightboxPhoto {
  id: string;
  /** The larger copy, so an enlarged photo stays sharp. */
  url: string;
}

/**
 * One photo at full size over the page, with the others a tap away.
 *
 * It shows the whole photo, uncropped, so the admin sees what was actually
 * uploaded rather than the framed version the cards show.
 */
export function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: LightboxPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const count = photos.length;
  // A photo can arrive or leave while this is open; never point past the end.
  const current = photos[Math.min(index, count - 1)];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (count < 2) return;
      if (e.key === "ArrowRight") onIndexChange((index + 1) % count);
      if (e.key === "ArrowLeft") onIndexChange((index - 1 + count) % count);
    }
    window.addEventListener("keydown", onKey);
    // The page behind must not scroll while the photo is over it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [count, index, onClose, onIndexChange]);

  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col gap-3 bg-ink-900/90 p-3 backdrop-blur-md sm:p-6"
    >
      <div className="flex shrink-0 items-center justify-between gap-3">
        <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white">
          {Math.min(index, count - 1) + 1} <span className="text-white/60">of {count}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo"
          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/25"
        >
          <X size={16} />
          <span className="hidden sm:inline">Close</span>
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {/* The sized copy straight from Blob Storage, so there is nothing for
            next/image to do. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.id}
          src={current.url}
          alt="Profile photo, enlarged"
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
        />

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange((index - 1 + count) % count);
              }}
              aria-label="Previous photo"
              className="absolute left-0 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-ink-900/55 text-white shadow-lg backdrop-blur-sm hover:bg-ink-900/75"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange((index + 1) % count);
              }}
              aria-label="Next photo"
              className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-ink-900/55 text-white shadow-lg backdrop-blur-sm hover:bg-ink-900/75"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
