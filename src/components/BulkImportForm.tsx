"use client";

import { startTransition, useActionState, useState } from "react";
import { AlertTriangle, Check, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  previewImportAction,
  runImportAction,
  type ImportState,
} from "@/lib/actions/import";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wider text-maroon-700/60">{label}</p>
      <p className="font-serif text-2xl text-maroon-700">{value}</p>
    </Card>
  );
}

function CountList({
  title,
  counts,
}: {
  title: string;
  counts: Record<string, number>;
}) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-maroon-700/70">
        {title}
      </p>
      <p className="text-sm text-ink-900/70">
        {entries.map(([name, n]) => `${name} (${n})`).join(", ")}
      </p>
    </div>
  );
}

/**
 * Upload, look, then import.
 *
 * The file is parsed twice on purpose: once to show what it holds, and again
 * on the real run. Nothing about the preview is carried back from the browser,
 * so what gets written is always read fresh from the file itself.
 */
export function BulkImportForm() {
  // The file is held here rather than read off the input at submit time:
  // React clears an uncontrolled form once its action completes, so by the
  // time Import is pressed the input the preview was run from is empty.
  const [file, setFile] = useState<File | null>(null);

  const [preview, previewAction, previewing] = useActionState<ImportState, FormData>(
    previewImportAction,
    {}
  );
  const [result, importAction, importing] = useActionState<ImportState, FormData>(
    runImportAction,
    {}
  );

  const p = preview.preview;
  const done = result.done;

  /** Both passes send the same file, built here instead of by the browser. */
  function submit(action: (data: FormData) => void) {
    if (!file) return;
    const data = new FormData();
    data.set("file", file);
    startTransition(() => action(data));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-gold-400/50 bg-blush-100/60 p-5">
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-maroon-700">
          <FileSpreadsheet size={18} />
          <span>Choose the CSV export</span>
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {file && <p className="text-sm text-ink-900/70">{file.name}</p>}

        {preview.error && <p className="text-sm text-red-700">{preview.error}</p>}
        {result.error && <p className="text-sm text-red-700">{result.error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => submit(previewAction)}
            disabled={previewing || importing || !file}
          >
            {previewing ? "Reading…" : "Check the file"}
          </Button>
          {p && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => submit(importAction)}
              disabled={previewing || importing}
            >
              <Upload size={15} />
              {importing ? `Importing ${p.usable} profiles…` : `Import ${p.usable} profiles`}
            </Button>
          )}
        </div>
        <p className="text-xs text-ink-900/50">
          Nothing is written until you press Import. Running the same file twice updates
          the profiles it created the first time rather than adding them again.
        </p>
      </div>

      {p && !done && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Rows in file" value={p.totalRows} />
            <Stat label="Will import" value={p.usable} />
            <Stat label="Already on books" value={p.alreadyOnBooks} />
            <Stat label="Will be inactive" value={p.inactive} />
          </div>

          <Card className="flex flex-col gap-3 p-5">
            <p className="text-sm text-ink-900/70">
              <b>{p.alreadyOnBooks}</b> of these were imported before and will be
              updated; the other <b>{p.usable - p.alreadyOnBooks}</b> are new.
              {p.inactive > 0 && (
                <>
                  {" "}
                  <b>{p.inactive}</b> were rejected in the old system and come in
                  switched off, so they are on the books without appearing in searches.
                </>
              )}
            </p>

            {p.skipped.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold-500">
                  <AlertTriangle size={13} /> {p.skipped.length} row
                  {p.skipped.length === 1 ? "" : "s"} skipped
                </p>
                <p className="text-sm text-ink-900/70">
                  {p.skipped
                    .slice(0, 12)
                    .map((s) => `#${s.sourceId} — ${s.reason}`)
                    .join("; ")}
                  {p.skipped.length > 12 ? ` …and ${p.skipped.length - 12} more` : ""}
                </p>
              </div>
            )}

            {p.dropped.photos > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-maroon-700/70">
                  Photos
                </p>
                <p className="text-sm text-ink-900/70">
                  The file lists {p.dropped.photos} photos, but only as paths on the old
                  server — there is no image data to bring across. Profiles arrive
                  without photos; add them per profile afterwards.
                </p>
              </div>
            )}

            <CountList
              title="Countries with no matching option (left blank, kept in private notes)"
              counts={p.dropped.unmappedCountries}
            />
            <CountList
              title="Jobs filed under Others (the exact title is kept in the job field)"
              counts={p.dropped.unmappedOccupations}
            />
          </Card>
        </div>
      )}

      {done && (
        <Card className="flex flex-col gap-2 p-5">
          <p className="flex items-center gap-2 font-medium text-olive-600">
            <Check size={16} /> Imported {done.written} profile
            {done.written === 1 ? "" : "s"}.
          </p>
          {done.failed.length > 0 ? (
            <p className="text-sm text-red-700">
              {done.failed.length} could not be written. First error:{" "}
              {done.failed[0].message}
            </p>
          ) : (
            <p className="text-sm text-ink-900/60">
              They are in All Profiles now, newest first.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
