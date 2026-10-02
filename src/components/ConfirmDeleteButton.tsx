"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * A delete control that asks once before it acts.
 *
 * Deliberately not window.confirm: that dialog is easy to dismiss by reflex,
 * says nothing about what is actually being removed, and is suppressed
 * outright in some browsers. Arming the button in place shows the consequence
 * next to the thing it applies to, and nothing is destroyed on a single click.
 */
export function ConfirmDeleteButton({
  action,
  label = "Delete",
  confirmLabel = "Yes, delete",
  description,
  iconOnly = false,
  size = "sm",
}: {
  /** A server action, already bound to whatever it deletes. */
  action: () => Promise<void>;
  label?: string;
  confirmLabel?: string;
  /** What exactly disappears. Shown only once the button is armed. */
  description?: string;
  iconOnly?: boolean;
  size?: "sm" | "md";
}) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!armed) {
    return (
      <Button
        type="button"
        size={size}
        variant="ghost"
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
        className="text-red-700 hover:bg-red-50"
        onClick={() => setArmed(true)}
      >
        <Trash2 size={14} /> {iconOnly ? null : label}
      </Button>
    );
  }

  return (
    // Stacked and width-capped: these controls sit in table cells and card
    // headers, and a wide armed state would shove the surrounding columns
    // sideways the moment it appears.
    <span className="inline-flex max-w-[260px] flex-col items-start gap-1.5 text-left align-top">
      {description && (
        <span className="text-xs text-ink-900/70">{description}</span>
      )}
      <span className="inline-flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size={size}
          variant="danger"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await action();
              } catch (e) {
                // A redirect from the action surfaces here as a thrown control
                // signal, so only real failures are reported.
                if (e && typeof e === "object" && "digest" in e) throw e;
                setError(
                  e instanceof Error ? e.message : "Could not delete that.",
                );
                setArmed(false);
              }
            })
          }
        >
          <Trash2 size={14} /> {pending ? "Deleting…" : confirmLabel}
        </Button>
        <Button
          type="button"
          size={size}
          variant="ghost"
          disabled={pending}
          onClick={() => setArmed(false)}
        >
          Cancel
        </Button>
      </span>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
