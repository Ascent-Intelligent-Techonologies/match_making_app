"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { saveTeamNoteAction, type TeamNoteState } from "@/lib/actions/team-notes";

/**
 * One consultant's running list of bullet points.
 *
 * Kept as a single editable block rather than a list of separate note rows:
 * these get reordered and rewritten constantly, and editing a paragraph is far
 * quicker than adding, editing and deleting rows one at a time. Lines are
 * bulleted automatically as you type so it still reads as a list.
 */
export function TeamNoteCard({
  slug,
  name,
  initialBody,
}: {
  slug: string;
  name: string;
  initialBody: string;
}) {
  const [body, setBody] = useState(initialBody);
  const [state, formAction, pending] = useActionState<TeamNoteState, FormData>(
    saveTeamNoteAction.bind(null, slug),
    {}
  );

  // What is on the server. The prop only refreshes on a full page load, so a
  // save has to move this itself or the card goes on claiming unsaved changes.
  // It records the text as it was when submitted, not as it is now, so typing
  // while a save is in flight correctly leaves the card dirty.
  const [baseline, setBaseline] = useState(initialBody);
  const submittedRef = useRef(initialBody);
  useEffect(() => {
    if (state.savedAt) setBaseline(submittedRef.current);
  }, [state.savedAt]);

  const dirty = body !== baseline;

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-xl font-semibold text-maroon-700">{name}</h2>
        {state.savedAt && !dirty && (
          <span className="flex items-center gap-1 text-xs font-medium text-olive-600">
            <Check size={13} /> Saved
          </span>
        )}
      </div>

      <form
        action={formAction}
        onSubmit={() => {
          submittedRef.current = body;
        }}
        className="flex flex-col gap-3"
      >
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            // Enter continues the list, so a bullet never has to be typed.
            if (e.key !== "Enter") return;
            const el = e.currentTarget;
            const lineStart = el.value.lastIndexOf("\n", el.selectionStart - 1) + 1;
            const line = el.value.slice(lineStart, el.selectionStart);
            if (!line.trimStart().startsWith("•")) return;
            e.preventDefault();
            const next =
              el.value.slice(0, el.selectionStart) +
              "\n• " +
              el.value.slice(el.selectionEnd);
            setBody(next);
            requestAnimationFrame(() => {
              const pos = el.selectionStart + 3;
              el.setSelectionRange(pos, pos);
            });
          }}
          onFocus={(e) => {
            if (e.currentTarget.value === "") setBody("• ");
          }}
          rows={12}
          placeholder="• Called the Rao family about Meghana"
          className="min-h-56 w-full resize-y rounded-lg border border-blush-300 bg-white/70 px-3.5 py-2.5 text-[15px] leading-relaxed text-ink-900 placeholder:text-ink-900/40 focus:border-maroon-600 focus:outline-none focus:ring-2 focus:ring-maroon-600/15"
        />

        {state.error && <p className="text-xs text-red-700">{state.error}</p>}

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink-900/50">
            {dirty ? "Unsaved changes" : "Up to date"}
          </span>
          <Button type="submit" size="sm" disabled={pending || !dirty}>
            <Save size={14} /> {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
