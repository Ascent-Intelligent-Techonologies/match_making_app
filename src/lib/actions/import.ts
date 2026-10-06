"use server";

import { revalidatePath } from "next/cache";
import { parseProfileCsv, type ImportSummary } from "@/lib/import/profile-csv";
import {
  bulkUpsertProfilesBySourceId,
  countExistingSourceIds,
} from "@/lib/data/profiles";

export interface ImportState {
  error?: string;
  /** Set after a dry run: what the file holds and what would happen. */
  preview?: ImportSummary & { alreadyOnBooks: number; fileName: string };
  /** Set after a real run. */
  done?: { written: number; failed: { sourceId: string; message: string }[] };
}

/** Reads the uploaded file off the form, shared by both passes. */
async function readCsv(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file first." as const };
  }
  return { file, text: await file.text() };
}

/**
 * Dry run. Parses and maps the whole file and reports what it found, writing
 * nothing — an import of a few thousand profiles is not something to start
 * without seeing what it will do first.
 */
export async function previewImportAction(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const read = await readCsv(formData);
  if ("error" in read) return { error: read.error };

  const { rows, summary, fatal } = parseProfileCsv(read.text);
  if (fatal) return { error: fatal };

  let alreadyOnBooks = 0;
  try {
    alreadyOnBooks = await countExistingSourceIds(rows.map((r) => r.sourceId));
  } catch {
    // Not knowing the overlap is not a reason to block the preview.
  }

  return { preview: { ...summary, alreadyOnBooks, fileName: read.file.name } };
}

/** The real thing. Re-parses rather than trusting anything from the browser. */
export async function runImportAction(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const read = await readCsv(formData);
  if ("error" in read) return { error: read.error };

  const { rows, fatal } = parseProfileCsv(read.text);
  if (fatal) return { error: fatal };
  if (rows.length === 0) return { error: "Nothing in that file could be imported." };

  const result = await bulkUpsertProfilesBySourceId(rows.map((r) => r.values));

  revalidatePath("/admin/profiles");
  revalidatePath("/admin/search");
  revalidatePath("/admin");
  return { done: result };
}
