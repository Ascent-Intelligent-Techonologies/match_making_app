import type { CSSProperties } from "react";

/**
 * How a photo sits inside the frames the site shows it in.
 *
 * A photo is framed once, as a focal point and a zoom, and every frame — the
 * wide admin card, the tall browse card, the small search thumbnail, the
 * slideshow — applies the same two numbers with CSS. That is what lets one
 * decision hold in frames of very different shapes, which a single baked crop
 * could not, and it leaves the stored image untouched so the framing can be
 * changed later.
 */
export interface PhotoFraming {
  /** Percent across the photo that stays in view: 0 left, 100 right. */
  x: number;
  /** Percent down the photo that stays in view: 0 top, 100 bottom. */
  y: number;
  /** 1 fills the frame; larger crops in around the focal point. */
  zoom: number;
}

/**
 * What an unframed photo gets. Weighted to the top because most photos here
 * are portraits of a person, and a face sits in the top third: centring a
 * tall photo in a wide card cut the head off.
 */
export const AUTO_FRAMING: PhotoFraming = { x: 50, y: 20, zoom: 1 };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The framing stored on a photo row, or the automatic one if it has none. */
export function framingOf(
  photo?: { focus_x?: number | null; focus_y?: number | null; zoom?: number | null } | null
): PhotoFraming {
  if (photo?.focus_x == null || photo?.focus_y == null) return AUTO_FRAMING;
  return {
    x: clamp(photo.focus_x, 0, 100),
    y: clamp(photo.focus_y, 0, 100),
    zoom: clamp(photo.zoom ?? 1, MIN_ZOOM, MAX_ZOOM),
  };
}

/** Anything that is not a sane framing becomes null; the rest is clamped and rounded. */
export function sanitizeFraming(input: unknown): PhotoFraming | null {
  if (!input || typeof input !== "object") return null;
  const { x, y, zoom } = input as Record<string, unknown>;
  if (![x, y, zoom].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return {
    x: round2(clamp(x as number, 0, 100)),
    y: round2(clamp(y as number, 0, 100)),
    zoom: round2(clamp(zoom as number, MIN_ZOOM, MAX_ZOOM)),
  };
}

/**
 * Inline style for an `object-fit: cover` image that fills a clipping frame.
 *
 * `object-position` puts the focal point at the same place in the frame as in
 * the photo; scaling about that same point then zooms in without moving it.
 * The frame must clip (`overflow-hidden`), or the scaled image spills out.
 */
export function framingStyle(f: PhotoFraming): CSSProperties {
  const origin = `${f.x}% ${f.y}%`;
  return {
    objectPosition: origin,
    transformOrigin: origin,
    transform: f.zoom > 1 ? `scale(${f.zoom})` : undefined,
  };
}
