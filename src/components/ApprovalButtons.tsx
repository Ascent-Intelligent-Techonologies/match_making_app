"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { describeActionError } from "@/lib/stale-deploy";
import type { DecisionResult } from "@/lib/actions/approvals";

/**
 * Approve and decline for a profile waiting for review, with the outcome shown
 * where the buttons are. The server actions come in already bound to the
 * profile. Declining is reversible (a declined profile can still be approved),
 * so it does not ask twice; approving puts the profile in front of clients.
 */
export function ApprovalButtons({
  approve,
  reject,
  approveLabel = "Approve",
}: {
  approve: () => Promise<DecisionResult>;
  /** Omitted for a profile that is already declined. */
  reject?: () => Promise<DecisionResult>;
  approveLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(decide: () => Promise<DecisionResult>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await decide();
        if (result.error) setError(result.error);
      } catch (caught) {
        setError(describeActionError(caught, "Could not save that decision."));
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={() => run(approve)}>
          <Check size={14} /> {approveLabel}
        </Button>
        {reject && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => run(reject)}
          >
            <X size={14} /> Decline
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
