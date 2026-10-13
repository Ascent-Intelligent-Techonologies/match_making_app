import "server-only";
import sharp from "sharp";

/**
 * The resized copies made from each uploaded photo, once, at upload time.
 *
 * Everything the site shows is one of these two; the original is kept but
 * never served to a page. That is what makes ten thousand HD photos a
 * storage question rather than a CPU one: the only time a photo is decoded
 * is the moment it arrives.
 *
 * The sizes are chosen for where they are shown, at 2× for sharp screens:
 *   thumb   480 px wide — grid cards and cover tiles, drawn at about 220 px
 *   medium 1200 px wide — the carousel, the slideshow and the share page,
 *                         drawn at up to 480 px on desktop and full-width on
 *                         a phone
 *
 * `azure/backfill-thumbnails.mjs` repeats these numbers for photos uploaded
 * before derivatives existed. Change them in both places or not at all.
 */
export const DERIVATIVE_SPECS = {
  thumb: { width: 480, quality: 78 },
  medium: { width: 1200, quality: 82 },
} as const;

export const DERIVATIVE_CONTENT_TYPE = "image/webp";

export interface Derivatives {
  thumb: Buffer;
  medium: Buffer;
  /** Of the original, after EXIF rotation. */
  width: number;
  height: number;
}

/**
 * Decodes an uploaded image and produces both derivatives.
 *
 * Throws if the bytes are not an image sharp can read — which is also how
 * the finalise step knows a browser did not upload something else under an
 * image's name.
 *
 * `rotate()` with no argument applies the EXIF orientation and strips the
 * tag, so a phone photo taken sideways comes out upright instead of relying
 * on every browser to honour the metadata. `withoutEnlargement` keeps a small
 * original small rather than blowing it up to the target width.
 */
export async function makeDerivatives(original: Buffer): Promise<Derivatives> {
  const base = sharp(original, { failOn: "error" }).rotate();
  const meta = await base.metadata();
  if (!meta.width || !meta.height) {
    throw new Error("That file is not an image we can read.");
  }

  const [thumb, medium] = await Promise.all([
    base
      .clone()
      .resize({ width: DERIVATIVE_SPECS.thumb.width, withoutEnlargement: true })
      .webp({ quality: DERIVATIVE_SPECS.thumb.quality })
      .toBuffer(),
    base
      .clone()
      .resize({ width: DERIVATIVE_SPECS.medium.width, withoutEnlargement: true })
      .webp({ quality: DERIVATIVE_SPECS.medium.quality })
      .toBuffer(),
  ]);

  // Orientation 5–8 swap the axes; the metadata reports the stored size,
  // not the displayed one.
  const swapped = (meta.orientation ?? 1) >= 5;
  return {
    thumb,
    medium,
    width: swapped ? meta.height : meta.width,
    height: swapped ? meta.width : meta.height,
  };
}
