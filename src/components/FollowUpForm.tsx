"use client";

import { useActionState } from "react";
import { PhoneCall } from "lucide-react";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { addFollowUpAction, type FollowupState } from "@/lib/actions/followups";

/** Log what was said when a client calls, against their record. */
export function FollowUpForm({ clientId }: { clientId: string }) {
  const [state, formAction, pending] = useActionState<FollowupState, FormData>(
    addFollowUpAction.bind(null, clientId),
    {}
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {/* Remounting on save clears the box without tracking the value here. */}
      <div key={state.savedAt ?? 0}>
        <Textarea
          name="note"
          required
          placeholder="e.g. Called about Sravani's profile — wants to see horoscope before deciding."
        />
      </div>
      {state.error && <p className="text-xs text-red-700">{state.error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          <PhoneCall size={14} /> {pending ? "Saving…" : "Log follow-up"}
        </Button>
      </div>
    </form>
  );
}
