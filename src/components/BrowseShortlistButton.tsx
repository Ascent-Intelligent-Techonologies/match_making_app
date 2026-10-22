"use client";

import { useRef, useState } from "react";
import { Heart } from "lucide-react";
import { toggleBrowseShortlistAction } from "@/lib/actions/browse";
import { noteIfSiteUpdated } from "@/lib/stale-deploy";

/** Heart shown on the public browse cards. */
export function BrowseShortlistButton({
  profileId,
  initialShortlisted,
}: {
  profileId: string;
  initialShortlisted: boolean;
}) {
  const [shortlisted, setShortlisted] = useState(initialShortlisted);
  // Taps that have been sent and not yet answered, and the last state the
  // server confirmed. The server toggles, and Next runs a client's actions
  // one after another, so any number of quick taps ends where an
  // odd/even count says; only the final answer is allowed to settle the heart.
  const inFlight = useRef(0);
  const confirmed = useRef(initialShortlisted);

  async function toggle(e: React.MouseEvent) {
    // The card is a link; hearting must not navigate.
    e.preventDefault();
    e.stopPropagation();

    // Flip at once and stay tappable. Each tap used to disable the button
    // until the server had saved it and re-rendered the whole page, which on
    // a slow connection made the heart feel stuck.
    setShortlisted((current) => !current);
    inFlight.current += 1;

    try {
      const result = await toggleBrowseShortlistAction(profileId);
      if (typeof result.shortlisted === "boolean") confirmed.current = result.shortlisted;
    } catch (error) {
      // Treated like any failed save: the heart falls back to the last
      // confirmed state below. If the page is out of date, say so as well.
      noteIfSiteUpdated(error);
    } finally {
      inFlight.current -= 1;
      if (inFlight.current === 0) setShortlisted(confirmed.current);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={shortlisted}
      aria-label={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
      title={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
      className={`absolute right-3 top-3 z-10 inline-flex items-center justify-center rounded-full p-2.5 shadow-sm backdrop-blur-sm transition-colors ${
        shortlisted
          ? "bg-maroon-600 text-blush-50"
          : "bg-white/90 text-maroon-700 hover:bg-white"
      }`}
    >
      <Heart size={16} fill={shortlisted ? "currentColor" : "none"} />
    </button>
  );
}
