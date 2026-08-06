"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Star, Trash2, ArrowLeft, ArrowRight, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ProfilePhoto } from "@/lib/types";
import type { PhotoActionState } from "@/lib/actions/photos";
import {
  deletePhotoAction,
  reorderPhotosAction,
  setCoverPhotoAction,
} from "@/lib/actions/photos";

export function PhotoManager({
  profileId,
  photos,
  uploadAction,
}: {
  profileId: string;
  photos: ProfilePhoto[];
  uploadAction: (
    state: PhotoActionState,
    formData: FormData
  ) => Promise<PhotoActionState>;
}) {
  const [state, formAction, pending] = useActionState<PhotoActionState, FormData>(
    uploadAction,
    {}
  );
  const [isPending, startTransition] = useTransition();
  const [isDragging, setIsDragging] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function move(index: number, direction: -1 | 1) {
    const next = [...photos];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    startTransition(() => {
      reorderPhotosAction(profileId, next.map((p) => p.id));
    });
  }

  function uploadFiles(files: FileList | File[]) {
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0 || !inputRef.current) return;
    const dt = new DataTransfer();
    images.forEach((f) => dt.items.add(f));
    inputRef.current.files = dt.files;
    formRef.current?.requestSubmit();
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        ref={formRef}
        action={(fd) => {
          formAction(fd);
          formRef.current?.reset();
        }}
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
        className={`flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4 transition-colors ${
          isDragging
            ? "border-maroon-600 bg-blush-200/70"
            : "border-gold-400/50 bg-blush-100/60"
        }`}
      >
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-maroon-700">
          <UploadCloud size={18} />
          <span>Choose photos</span>
          <input
            ref={inputRef}
            type="file"
            name="photos"
            accept="image/*"
            multiple
            className="hidden"
            onChange={() => formRef.current?.requestSubmit()}
          />
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </Button>
        <span className="text-xs text-ink-900/40">or drag photos here</span>
        {state.error && <p className="text-xs text-red-700">{state.error}</p>}
      </form>

      {photos.length === 0 ? (
        <p className="text-sm text-ink-900/50">No photos uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-blush-200 bg-blush-100"
            >
              {photo.signedUrl && (
                <Image
                  src={photo.signedUrl}
                  alt="Profile photo"
                  fill
                  sizes="220px"
                  className="object-cover"
                />
              )}
              {photo.is_cover && (
                <span className="absolute left-2 top-2 rounded-full bg-maroon-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-blush-50">
                  Cover
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  title="Move left"
                  disabled={isPending}
                  onClick={() => move(index, -1)}
                  className="rounded-full bg-white/90 p-1.5 text-ink-900 cursor-pointer"
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  type="button"
                  title="Set as cover"
                  disabled={isPending}
                  onClick={() => startTransition(() => setCoverPhotoAction(profileId, photo.id))}
                  className="rounded-full bg-white/90 p-1.5 text-gold-500 cursor-pointer"
                >
                  <Star size={14} />
                </button>
                <button
                  type="button"
                  title="Delete"
                  disabled={isPending}
                  onClick={() => startTransition(() => deletePhotoAction(profileId, photo.id))}
                  className="rounded-full bg-white/90 p-1.5 text-red-700 cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  type="button"
                  title="Move right"
                  disabled={isPending}
                  onClick={() => move(index, 1)}
                  className="rounded-full bg-white/90 p-1.5 text-ink-900 cursor-pointer"
                >
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
