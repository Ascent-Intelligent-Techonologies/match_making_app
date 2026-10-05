"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import {
  uploadJourneyMediaAction,
  type JourneyUploadState,
} from "@/lib/actions/journey";

/** Adds photos and videos to the Journey page, by picker or by drag and drop. */
export function JourneyUploader() {
  const [state, formAction, pending] = useActionState<JourneyUploadState, FormData>(
    uploadJourneyMediaAction,
    {}
  );
  const [chosen, setChosen] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the queue once it has been uploaded. Leaving the files selected
  // invites a second click that uploads the same thing again.
  useEffect(() => {
    if (!state.uploadedAt || state.error) return;
    setChosen([]);
    formRef.current?.reset();
  }, [state.uploadedAt, state.error]);

  function applyFiles(files: FileList | File[]) {
    const list = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    if (list.length === 0) return;

    const dt = new DataTransfer();
    list.forEach((f) => dt.items.add(f));
    if (inputRef.current) inputRef.current.files = dt.files;
    setChosen(list.map((f) => f.name));
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        applyFiles(e.dataTransfer.files);
      }}
      className={`flex flex-col gap-3 rounded-2xl border border-dashed p-5 transition-colors ${
        isDragging ? "border-maroon-600 bg-blush-200/70" : "border-gold-400/50 bg-blush-100/60"
      }`}
    >
      {/* One control, not two: an adjacent button next to a file input is the
          classic way to submit an empty form by accident. */}
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-maroon-700">
        <UploadCloud size={18} />
        <span>Choose photos or videos, or drag them here</span>
        <input
          ref={inputRef}
          type="file"
          name="media"
          accept="image/*,video/*"
          multiple
          className="sr-only"
          onChange={(e) => applyFiles(e.target.files ?? [])}
        />
      </label>

      {chosen.length > 0 && (
        <p className="text-xs text-ink-900/60">
          {chosen.length} file{chosen.length === 1 ? "" : "s"} ready: {chosen.join(", ")}
        </p>
      )}

      <Input name="caption" placeholder="Caption (optional)" className="max-w-md" />

      {state.error && <p className="text-xs text-red-700">{state.error}</p>}
      {state.uploadedAt && !state.error && (
        <p className="text-xs text-olive-600">
          Uploaded {state.count} file{state.count === 1 ? "" : "s"}.
        </p>
      )}

      <div>
        <Button type="submit" size="sm" disabled={pending || chosen.length === 0}>
          {pending ? "Uploading…" : "Upload"}
        </Button>
      </div>
    </form>
  );
}
