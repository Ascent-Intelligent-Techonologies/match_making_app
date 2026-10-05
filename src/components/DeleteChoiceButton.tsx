"use client";

import { useState, useTransition } from "react";
import { Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Delete control for records that can be recovered: profiles and clients.
 *
 * Arming it offers the choice rather than assuming one. Moving to Deleted is
 * what almost every delete actually means — the record is off the books but
 * recoverable from the Deleted page — so it leads, and the permanent option
 * sits beside it, spelled out, for when the record should genuinely be gone.
 *
 * Notes, shortlist entries and share links use ConfirmDeleteButton instead:
 * there is nothing meaningful to restore for a one-line note.
 */
export function DeleteChoiceButton({
  softAction,
  hardAction,
  label = "Delete",
  what,
  hardDescription,
}: {
  /** Server action bound to the record, moving it to Deleted. */
  softAction: () => Promise<void>;
  /** Server action bound to the record, destroying it. */
  hardAction: () => Promise<void>;
  label?: string;
  /** Named in the prompt, e.g. "this profile". */
  what: string;
  /** What permanent deletion takes with it. */
  hardDescription: string;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        // A redirect from the action arrives here as a control signal.
        if (e && typeof e === "object" && "digest" in e) throw e;
        setError(e instanceof Error ? e.message : "Could not delete that.");
        setArmed(false);
      }
    });
  }

  if (!armed) {
    return (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-red-700 hover:bg-red-50"
        onClick={() => setArmed(true)}
      >
        <Trash2 size={14} /> {label}
      </Button>
    );
  }

  return (
    <span className="inline-flex max-w-[320px] flex-col items-start gap-2 rounded-xl border border-red-700/20 bg-red-50/60 p-3 text-left">
      <span className="text-xs font-semibold text-ink-900/80">How should {what} go?</span>

      <Button type="button" size="sm" disabled={pending} onClick={() => run(softAction)}>
        <Archive size={14} /> Move to Deleted
      </Button>
      <span className="text-[11px] text-ink-900/60">
        Hidden everywhere, kept on the Deleted page, restorable at any time.
      </span>

      <Button
        type="button"
        size="sm"
        variant="danger"
        disabled={pending}
        onClick={() => run(hardAction)}
      >
        <Trash2 size={14} /> Delete permanently
      </Button>
      <span className="text-[11px] text-ink-900/60">{hardDescription}</span>

      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => setArmed(false)}
      >
        Cancel
      </Button>
      {pending && <span className="text-[11px] text-ink-900/60">Working…</span>}
      {error && <span className="text-[11px] text-red-700">{error}</span>}
    </span>
  );
}
