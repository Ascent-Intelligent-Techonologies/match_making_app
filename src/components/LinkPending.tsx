"use client";

import { useLinkStatus } from "next/link";

/** A small spinner that shows inside a <Link> from the click until the next page has arrived. */
export function LinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
