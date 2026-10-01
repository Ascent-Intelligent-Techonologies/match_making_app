"use client";

import { useEffect, useRef } from "react";
import { recordBrowseSearchAction } from "@/lib/actions/browse";

/**
 * Logs the filter set a browsing client applied.
 *
 * Runs from the browser rather than during render so repeat renders (and any
 * revalidation triggered by shortlisting) don't log phantom searches.
 */
export function BrowseSearchTracker({
  filters,
  resultCount,
}: {
  filters: Record<string, string>;
  resultCount: number;
}) {
  const lastLogged = useRef<string | null>(null);
  const key = JSON.stringify(filters);

  useEffect(() => {
    // Only log once an actual filter is applied, and never the same set twice.
    if (Object.keys(JSON.parse(key) as Record<string, string>).length === 0) return;
    if (lastLogged.current === key) return;
    lastLogged.current = key;
    void recordBrowseSearchAction(JSON.parse(key), resultCount);
  }, [key, resultCount]);

  return null;
}
