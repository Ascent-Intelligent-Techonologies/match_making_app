"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { toggleBrowseShortlistAction } from "@/lib/actions/browse";

/** Heart shown on the public browse cards. */
export function BrowseShortlistButton({
  profileId,
  initialShortlisted,
}: {
  profileId: string;
  initialShortlisted: boolean;
}) {
  const [shortlisted, setShortlisted] = useState(initialShortlisted);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    // The card is a link; hearting must not navigate.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    const optimistic = !shortlisted;
    setShortlisted(optimistic);
    setBusy(true);

    const result = await toggleBrowseShortlistAction(profileId);
    if (result.error) setShortlisted(!optimistic);
    else if (typeof result.shortlisted === "boolean") setShortlisted(result.shortlisted);
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={shortlisted}
      aria-label={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
      title={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
      className={`absolute right-3 top-3 z-10 inline-flex items-center justify-center rounded-full p-2.5 shadow-sm backdrop-blur-sm transition-colors disabled:opacity-60 ${
        shortlisted
          ? "bg-maroon-600 text-blush-50"
          : "bg-white/90 text-maroon-700 hover:bg-white"
      }`}
    >
      <Heart size={16} fill={shortlisted ? "currentColor" : "none"} />
    </button>
  );
}
