"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { describeActionError } from "@/lib/stale-deploy";
import Image from "next/image";
import { AlertCircle, ArrowLeft, ArrowRight, Crop, Star, Trash2, UploadCloud, X } from "lucide-react";
import type { ProfilePhoto } from "@/lib/types";
import { MAX_PHOTO_BYTES } from "@/lib/constants";
import { framingOf, framingStyle, type PhotoFraming } from "@/lib/framing";
import { PhotoFramer } from "@/components/PhotoFramer";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import {
  deletePhotoAction,
  finalisePhotoUploadAction,
  reorderPhotosAction,
  requestPhotoUploadAction,
  setCoverPhotoAction,
  updatePhotoFramingAction,
} from "@/lib/actions/photos";

/**
 * Uploads go straight from the browser to Blob Storage.
 *
 * For each file: ask the server for a write-only URL (step one), PUT the
 * bytes there (the only hop that carries the image, and it never touches our
 * server), then ask the server to finalise it (step two: validate, make the
 * resized copies, record the row). Three files are in flight at a time —
 * enough to keep a connection busy, few enough that one slow photo cannot
 * hold the rest of a batch hostage.
 *
 * Before any of that, each photo goes through the framing step: the admin
 * drags and zooms it into the shape the cards show, or skips for the
 * automatic framing. The choice rides along with the finalise call.
 */

type JobStatus = "queued" | "uploading" | "finalising" | "done" | "error";

interface UploadJob {
  id: string;
  name: string;
  status: JobStatus;
  /** 0–1, for the bar. */
  progress: number;
  error?: string;
}

const CONCURRENCY = 3;

interface QueuedFile {
  id: string;
  file: File;
  /** For the framing preview only. */
  url: string;
}

/**
 * At most `max` tasks at once. A finished task hands its slot straight to the
 * next waiter, so the count never dips below the work available.
 */
function createLimiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

/** A PUT that reports progress, which fetch() still cannot do for uploads. */
function putBlob(url: string, file: File, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    // Required by the Blob service for a single-shot upload.
    xhr.setRequestHeader("x-ms-blob-type", "BlockBlob");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status === 201
        ? resolve()
        : reject(new Error(`Storage answered ${xhr.status} while uploading.`));
    xhr.onerror = () => reject(new Error("The upload could not reach storage."));
    xhr.ontimeout = () => reject(new Error("The upload timed out."));
    xhr.timeout = 9 * 60 * 1000; // under the ten-minute life of the URL
    xhr.send(file);
  });
}

export function PhotoManager({
  profileId,
  photos,
}: {
  profileId: string;
  photos: ProfilePhoto[];
}) {
  const [isPending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  // Files waiting for the admin to frame them, one dialog at a time.
  const [framingQueue, setFramingQueue] = useState<QueuedFile[]>([]);
  const [adjusting, setAdjusting] = useState<ProfilePhoto | null>(null);
  // The photo shown enlarged. Held by id so a re-order cannot swap it underneath.
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [limit] = useState(() => createLimiter(CONCURRENCY));
  const inputRef = useRef<HTMLInputElement>(null);

  const patchJob = useCallback((id: string, patch: Partial<UploadJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const uploadOne = useCallback(
    async (job: UploadJob, file: File, framing: PhotoFraming | null) => {
      try {
        patchJob(job.id, { status: "uploading", progress: 0 });
        const ticket = await requestPhotoUploadAction(profileId, {
          name: file.name,
          type: file.type,
          size: file.size,
        });
        if ("error" in ticket) throw new Error(ticket.error);

        await putBlob(ticket.ticket.uploadUrl, file, (fraction) =>
          patchJob(job.id, { progress: fraction })
        );

        patchJob(job.id, { status: "finalising", progress: 1 });
        const result = await finalisePhotoUploadAction(profileId, ticket.ticket.path, framing);
        if ("error" in result) throw new Error(result.error);

        // The server component owns the photo list, and finalise revalidates
        // the page, so the new tile arrives with that call's own response.
        // (A separate router.refresh() here rendered the whole editor a
        // second time for every photo.)
        patchJob(job.id, { status: "done" });
      } catch (error) {
        patchJob(job.id, {
          status: "error",
          error: describeActionError(error, "Upload failed."),
        });
      }
    },
    [patchJob, profileId]
  );

  /** Runs one file's upload (when a slot is free), with the framing already chosen. */
  const startUpload = useCallback(
    (file: File, framing: PhotoFraming | null) => {
      const job: UploadJob = {
        id: crypto.randomUUID(),
        name: file.name,
        status: "queued",
        progress: 0,
      };
      setJobs((prev) => [...prev, job]);
      void limit(() => uploadOne(job, file, framing));
    },
    [limit, uploadOne]
  );

  const uploadFiles = useCallback((files: FileList | File[]) => {
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;

    // Caught here so an oversized file fails instantly, not after a 30 MB
    // upload the server then refuses.
    const tooBig = images.filter((f) => f.size > MAX_PHOTO_BYTES);
    if (tooBig.length > 0) {
      setJobs((prev) => [
        ...prev,
        ...tooBig.map((f) => ({
          id: crypto.randomUUID(),
          name: f.name,
          status: "error" as JobStatus,
          progress: 0,
          error: `Over the ${MAX_PHOTO_BYTES / 1_048_576} MB limit.`,
        })),
      ]);
    }

    const accepted = images.filter((f) => f.size <= MAX_PHOTO_BYTES);
    setFramingQueue((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
      })),
    ]);
  }, []);

  const framingFile = framingQueue[0];

  function frameCurrent(framing: PhotoFraming | null) {
    if (!framingFile) return;
    startUpload(framingFile.file, framing);
    URL.revokeObjectURL(framingFile.url);
    setFramingQueue((queue) => queue.slice(1));
  }

  function skipRemaining() {
    framingQueue.forEach((queued) => {
      startUpload(queued.file, null);
      URL.revokeObjectURL(queued.url);
    });
    setFramingQueue([]);
  }

  function cancelFraming() {
    framingQueue.forEach((queued) => URL.revokeObjectURL(queued.url));
    setFramingQueue([]);
  }

  // Finished jobs leave the list on their own; failures stay until dismissed.
  useEffect(() => {
    if (!jobs.some((j) => j.status === "done")) return;
    const t = setTimeout(
      () => setJobs((prev) => prev.filter((j) => j.status !== "done")),
      1500
    );
    return () => clearTimeout(t);
  }, [jobs]);

  // Paste-to-upload: a third input path that needs neither the OS file picker
  // nor a drag source. Copy an image anywhere, then press Cmd/Ctrl+V.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.some((f) => f.type.startsWith("image/"))) {
        e.preventDefault();
        uploadFiles(files);
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [uploadFiles]);

  function move(index: number, direction: -1 | 1) {
    const next = [...photos];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    startTransition(() => {
      reorderPhotosAction(profileId, next.map((p) => p.id));
    });
  }

  const active = jobs.filter((j) => j.status === "uploading" || j.status === "finalising");

  // What the enlarged view steps through: the photos that have a large copy.
  const viewable = photos.flatMap((p) => {
    const url = p.mediumUrl ?? p.signedUrl;
    return url ? [{ id: p.id, url }] : [];
  });
  const viewingIndex = viewingId ? viewable.findIndex((p) => p.id === viewingId) : -1;

  return (
    <div className="flex flex-col gap-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          uploadFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col gap-3 rounded-xl border border-dashed p-4 transition-colors ${
          isDragging
            ? "border-maroon-600 bg-blush-200/70"
            : "border-gold-400/50 bg-blush-100/60"
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Single control: selecting files uploads them immediately, so a
              separate submit button would only ever be a dead end. */}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-maroon-600 px-5 py-2.5 text-sm font-medium text-blush-50 transition-opacity hover:opacity-90 focus-within:ring-2 focus-within:ring-maroon-600/40">
            <UploadCloud size={16} />
            <span>{active.length > 0 ? `Uploading ${active.length}…` : "Add photos"}</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) uploadFiles(e.target.files);
                // So the same file can be chosen again after a failure.
                e.target.value = "";
              }}
            />
          </label>
          <span className="text-xs text-ink-900/40">
            or drag photos here, or paste one · you will frame each one · up to {MAX_PHOTO_BYTES / 1_048_576} MB each
          </span>
        </div>

        {jobs.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="flex items-center gap-3 rounded-lg bg-white/70 px-3 py-1.5 text-xs"
              >
                <span className="min-w-0 flex-1 truncate text-ink-900/80">{job.name}</span>
                {job.status === "error" ? (
                  <>
                    <span className="flex items-center gap-1 text-red-700">
                      <AlertCircle size={12} /> {job.error}
                    </span>
                    <button
                      type="button"
                      aria-label="Dismiss"
                      onClick={() => setJobs((prev) => prev.filter((j) => j.id !== job.id))}
                      className="rounded-full p-0.5 text-ink-900/50 hover:text-ink-900"
                    >
                      <X size={12} />
                    </button>
                  </>
                ) : job.status === "done" ? (
                  <span className="text-olive-600">Added</span>
                ) : (
                  <>
                    <span className="h-1.5 w-28 overflow-hidden rounded-full bg-blush-200">
                      <span
                        className="block h-full rounded-full bg-maroon-600 transition-[width]"
                        style={{ width: `${Math.round(job.progress * 100)}%` }}
                      />
                    </span>
                    <span className="w-16 text-right text-ink-900/50">
                      {job.status === "finalising"
                        ? "Resizing…"
                        : job.status === "uploading"
                          ? `${Math.round(job.progress * 100)}%`
                          : "Waiting"}
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-ink-900/50">No photos uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo, index) => {
            // A zoomed photo is drawn from the larger copy so it stays sharp.
            const src =
              (photo.zoom && photo.zoom > 1 ? photo.mediumUrl : photo.thumbUrl) ?? photo.signedUrl;
            return (
              <div
                key={photo.id}
                className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-blush-200 bg-blush-100"
              >
                {src && (
                  <Image
                    src={src}
                    alt="Profile photo"
                    fill
                    sizes="220px"
                    className="object-cover"
                    style={framingStyle(framingOf(photo))}
                    unoptimized
                  />
                )}
                {/* Covers the whole tile; the badge and the buttons below are
                    later siblings, so they sit above it and stay clickable. */}
                {(photo.mediumUrl ?? photo.signedUrl) && (
                  <button
                    type="button"
                    aria-label="View this photo larger"
                    title="Click to enlarge"
                    onClick={() => setViewingId(photo.id)}
                    className="absolute inset-0 cursor-zoom-in"
                  />
                )}
                {photo.is_cover && (
                  <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-maroon-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-blush-50">
                    Cover
                  </span>
                )}
                {/* The strip lets clicks through, so only the buttons on it act
                    and the gaps between them still open the photo. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 [&>button]:pointer-events-auto">
                  <button
                    type="button"
                    title="Move left"
                    disabled={isPending}
                    onClick={() => move(index, -1)}
                    className="cursor-pointer rounded-full bg-white/90 p-1.5 text-ink-900"
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <button
                    type="button"
                    title="Adjust framing"
                    disabled={isPending}
                    onClick={() => setAdjusting(photo)}
                    className="cursor-pointer rounded-full bg-white/90 p-1.5 text-ink-900"
                  >
                    <Crop size={14} />
                  </button>
                  <button
                    type="button"
                    title="Set as cover"
                    disabled={isPending}
                    onClick={() => startTransition(() => setCoverPhotoAction(profileId, photo.id))}
                    className="cursor-pointer rounded-full bg-white/90 p-1.5 text-gold-500"
                  >
                    <Star size={14} />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    disabled={isPending}
                    onClick={() => startTransition(() => deletePhotoAction(profileId, photo.id))}
                    className="cursor-pointer rounded-full bg-white/90 p-1.5 text-red-700"
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    type="button"
                    title="Move right"
                    disabled={isPending}
                    onClick={() => move(index, 1)}
                    className="cursor-pointer rounded-full bg-white/90 p-1.5 text-ink-900"
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewingIndex >= 0 && (
        <PhotoLightbox
          photos={viewable}
          index={viewingIndex}
          onIndexChange={(i) => setViewingId(viewable[i].id)}
          onClose={() => setViewingId(null)}
        />
      )}

      {framingFile && (
        <PhotoFramer
          key={framingFile.id}
          src={framingFile.url}
          title={framingFile.file.name}
          position={framingQueue.length > 1 ? `${framingQueue.length} photos to frame` : undefined}
          onConfirm={frameCurrent}
          onSkip={() => frameCurrent(null)}
          onSkipAll={framingQueue.length > 1 ? skipRemaining : undefined}
          onCancel={cancelFraming}
          // A format this browser cannot draw: upload it as it is and let the
          // server decide whether it is a readable image.
          onUnreadable={() => frameCurrent(null)}
        />
      )}

      {adjusting && (adjusting.mediumUrl ?? adjusting.signedUrl) && (
        <PhotoFramer
          key={adjusting.id}
          src={(adjusting.mediumUrl ?? adjusting.signedUrl)!}
          title="Photo already on this profile"
          initial={framingOf(adjusting)}
          confirmLabel="Save framing"
          onConfirm={(framing) => {
            const photo = adjusting;
            setAdjusting(null);
            startTransition(async () => {
              await updatePhotoFramingAction(profileId, photo.id, framing);
            });
          }}
          onCancel={() => setAdjusting(null)}
        />
      )}
    </div>
  );
}
