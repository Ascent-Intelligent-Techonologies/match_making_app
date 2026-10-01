"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { toggleShortlistAction } from "@/lib/actions/shortlists";

/**
 * The client-facing heart on a shared profile. Fills in when shortlisted.
 * Updates optimistically and rolls back if the server rejects the change.
 */
export function ShortlistButton({
  token,
  profileId,
  initialShortlisted,
}: {
  token: string;
  profileId: string;
  initialShortlisted: boolean;
}) {
  const [shortlisted, setShortlisted] = useState(initialShortlisted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    const optimistic = !shortlisted;
    setShortlisted(optimistic);
    setBusy(true);
    setError(null);

    const result = await toggleShortlistAction(token, profileId);

    if (result.error) {
      setShortlisted(!optimistic);
      setError(result.error);
    } else if (typeof result.shortlisted === "boolean") {
      setShortlisted(result.shortlisted);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={shortlisted}
        aria-label={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
        title={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
        className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
          shortlisted
            ? "border-maroon-600 bg-maroon-600 text-blush-50"
            : "border-gold-400 bg-white/70 text-maroon-700 hover:bg-blush-100"
        }`}
      >
        <Heart size={18} fill={shortlisted ? "currentColor" : "none"} />
        <span>{shortlisted ? "Shortlisted" : "Shortlist"}</span>
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
