"use server";

import { getShareLinkByToken, recordShareLinkView } from "@/lib/data/share-links";

/**
 * Records that a client actually opened a share link.
 *
 * Deliberately called from the browser on mount rather than during render:
 * the page re-renders server-side whenever a shortlist is toggled, so counting
 * views at render time would inflate them and wrongly mark silent clients as
 * having responded.
 */
export async function recordShareViewAction(token: string): Promise<void> {
  const link = await getShareLinkByToken(token);
  if (!link || link.revoked) return;

  await recordShareLinkView(link.id, link.client_id, link.view_count, link.first_viewed_at);
}
