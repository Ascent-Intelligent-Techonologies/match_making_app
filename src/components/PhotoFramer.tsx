"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AUTO_FRAMING, MAX_ZOOM, MIN_ZOOM, framingStyle, type PhotoFraming } from "@/lib/framing";

/**
 * Choose how a photo sits in its cards: drag to move it, slide to zoom.
 *
 * The big frame is the wide card, because that is the shape a portrait is
 * hurt most by. The two small ones below show the same framing in the tall
 * browse card and the search thumbnail, drawn by the same CSS the site uses,
 * so what is chosen here is what each place will show.
 */

interface PhotoFramerProps {
  src: string;
  title: string;
  initial?: PhotoFraming;
  /** "Photo 2 of 5", when several are being framed in a row. */
  position?: string;
  confirmLabel?: string;
  onConfirm: (framing: PhotoFraming) => void;
  /** Upload the photo with the automatic framing. */
  onSkip?: () => void;
  onSkipAll?: () => void;
  onCancel: () => void;
  /** The browser could not draw this file (a HEIC on desktop Chrome, say). */
  onUnreadable?: () => void;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function PhotoFramer({
  src,
  title,
  initial = AUTO_FRAMING,
  position,
  confirmLabel = "Use this framing",
  onConfirm,
  onSkip,
  onSkipAll,
  onCancel,
  onUnreadable,
}: PhotoFramerProps) {
  const [framing, setFraming] = useState<PhotoFraming>(initial);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    px: number;
    py: number;
    x: number;
    y: number;
    rangeX: number;
    rangeY: number;
  } | null>(null);

  const setZoom = (zoom: number) =>
    setFraming((f) => ({ ...f, zoom: clamp(Math.round(zoom * 100) / 100, MIN_ZOOM, MAX_ZOOM) }));

  /**
   * How far the photo can travel on each axis at the current zoom, in pixels:
   * its size once it covers the frame and is zoomed, less the frame. The
   * focal point runs 0–100 across exactly that distance, so a drag of d
   * pixels is a change of d / range of the way along.
   */
  function travel(frame: DOMRect, zoom: number) {
    if (!natural) return { rangeX: 0, rangeY: 0 };
    const cover = Math.max(frame.width / natural.w, frame.height / natural.h);
    return {
      rangeX: natural.w * cover * zoom - frame.width,
      rangeY: natural.h * cover * zoom - frame.height,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!natural) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      px: e.clientX,
      py: e.clientY,
      x: framing.x,
      y: framing.y,
      ...travel(e.currentTarget.getBoundingClientRect(), framing.zoom),
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    // Dragging the photo right brings more of its left side into view.
    setFraming((f) => ({
      ...f,
      x: d.rangeX > 0 ? clamp(d.x - ((e.clientX - d.px) / d.rangeX) * 100, 0, 100) : f.x,
      y: d.rangeY > 0 ? clamp(d.y - ((e.clientY - d.py) / d.rangeY) * 100, 0, 100) : f.y,
    }));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 8 : 2;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      setFraming((f) => ({ ...f, x: clamp(f.x + dx, 0, 100), y: clamp(f.y + dy, 0, 100) }));
    } else if (e.key === "+" || e.key === "=") {
      setZoom(framing.zoom + 0.1);
    } else if (e.key === "-") {
      setZoom(framing.zoom - 0.1);
    }
  }

  // Mouse-wheel zoom. React's own onWheel is passive, which would let the page
  // scroll underneath instead, so this one is attached by hand.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setFraming((f) => ({
        ...f,
        zoom: clamp(Math.round((f.zoom - e.deltaY * 0.0015) * 100) / 100, MIN_ZOOM, MAX_ZOOM),
      }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    dialogRef.current?.focus();
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [onCancel]);

  const image = (className: string) => (
    // A plain <img>: this is a local preview (an object URL or a signed Blob
    // URL), so there is nothing for next/image to resize.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      draggable={false}
      className={className}
      style={framingStyle(framing)}
    />
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Frame the photo"
        tabIndex={-1}
        className="flex max-h-[94vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl outline-none"
      >
        <div>
          <h2 className="font-serif text-xl font-semibold text-maroon-700">Frame the photo</h2>
          <p className="mt-0.5 truncate text-xs text-ink-900/50">
            {position ? `${position} · ` : ""}
            {title}
          </p>
        </div>

        <div
          ref={frameRef}
          role="group"
          aria-label="Photo frame. Drag to move, or use the arrow keys."
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={onKeyDown}
          className="relative aspect-[4/3] w-full cursor-grab touch-none select-none overflow-hidden rounded-xl bg-blush-100 outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-maroon-600/50"
        >
          {/* Re-measured when the image arrives: the drag maths needs its real size. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={framingStyle(framing)}
            onLoad={(e) =>
              setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
            }
            onError={() => onUnreadable?.()}
          />
        </div>
        <p className="-mt-2 text-xs text-ink-900/50">
          Drag the photo to move it. Use the slider or your mouse wheel to zoom.
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom(framing.zoom - 0.1)}
            className="cursor-pointer rounded-full p-1.5 text-maroon-700 hover:bg-blush-100"
          >
            <Minus size={16} />
          </button>
          <input
            type="range"
            aria-label="Zoom"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={framing.zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 flex-1 cursor-pointer accent-maroon-600"
          />
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom(framing.zoom + 0.1)}
            className="cursor-pointer rounded-full p-1.5 text-maroon-700 hover:bg-blush-100"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            onClick={() => setFraming(AUTO_FRAMING)}
            className="ml-1 inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-maroon-700 hover:bg-blush-100"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
            Also shown like this
          </p>
          <div className="flex items-end gap-5">
            <figure className="flex flex-col items-center gap-1">
              <div className="relative aspect-[4/5] w-24 overflow-hidden rounded-lg bg-blush-100">
                {image("absolute inset-0 h-full w-full object-cover")}
              </div>
              <figcaption className="text-[11px] text-ink-900/50">Browse card</figcaption>
            </figure>
            <figure className="flex flex-col items-center gap-1">
              <div className="relative h-24 w-20 overflow-hidden rounded-lg bg-blush-100">
                {image("absolute inset-0 h-full w-full object-cover")}
              </div>
              <figcaption className="text-[11px] text-ink-900/50">Search list</figcaption>
            </figure>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-blush-200 pt-4">
          {onSkipAll && (
            <button
              type="button"
              onClick={onSkipAll}
              className="mr-auto cursor-pointer text-xs text-ink-900/50 underline-offset-2 hover:underline"
            >
              Skip all remaining
            </button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          {onSkip && (
            <Button type="button" variant="secondary" size="sm" onClick={onSkip}>
              Use automatic
            </Button>
          )}
          <Button type="button" size="sm" onClick={() => onConfirm(framing)}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
