"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldLabel, Textarea } from "@/components/ui/Field";
import { ProfilePicker } from "@/components/ProfilePicker";
import { describeActionError } from "@/lib/stale-deploy";
import { addClientMatchAction } from "@/lib/actions/client-matches";
import { MAX_MATCH_NOTES_LENGTH, type MatchProfile } from "@/lib/client-match";

/**
 * "Add new row" for the Client match list: closed to a button until wanted, then
 * a boy's profile, a girl's profile and a few notes. The list refreshes itself
 * once the pair is saved (the action revalidates the page).
 */
export function NewClientMatchForm() {
  const [open, setOpen] = useState(false);
  const [boy, setBoy] = useState<MatchProfile | null>(null);
  const [girl, setGirl] = useState<MatchProfile | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setBoy(null);
    setGirl(null);
    setNotes("");
    setError(null);
  }

  function save() {
    if (!boy || !girl) {
      setError("Pick a boy's profile and a girl's profile.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await addClientMatchAction(boy.id, girl.id, notes);
        if (result.error) setError(result.error);
        else close();
      } catch (caught) {
        setError(describeActionError(caught, "Could not save that."));
      }
    });
  }

  if (!open) {
    return (
      <div>
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus size={16} /> Add new row
        </Button>
      </div>
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="font-serif text-xl font-semibold text-maroon-700">New match</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="match-boy">Boy&rsquo;s profile</FieldLabel>
          <ProfilePicker id="match-boy" side="boy" value={boy} onChange={setBoy} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="match-girl">Girl&rsquo;s profile</FieldLabel>
          <ProfilePicker id="match-girl" side="girl" value={girl} onChange={setGirl} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="match-notes">Notes</FieldLabel>
        <Textarea
          id="match-notes"
          value={notes}
          maxLength={MAX_MATCH_NOTES_LENGTH}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Where the conversation stands, who is speaking to whom, what happens next…"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Add to list"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={close}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
