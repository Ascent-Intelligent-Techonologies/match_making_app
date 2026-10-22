import { unstable_isUnrecognizedActionError } from "next/navigation";

/**
 * Helpers for a page that was opened before the latest deploy.
 *
 * Every build gives its server actions new ids, and the new server does not
 * know the old ones, so a button on a stale page cannot work however many
 * times it is pressed. Next reports that with a specific error. Left alone it
 * either crashed the page or, where the click handler swallows errors, made
 * the button appear to do nothing. These turn it into one clear message.
 *
 * Client components only.
 */

export const SITE_UPDATED_EVENT = "anurupa:site-updated";

export const SITE_UPDATED_MESSAGE =
  "The site was updated while this page was open. Reload the page and try again.";

/**
 * Call from a catch block. If the error means the page is out of date, the
 * page-wide notice is raised and this returns true; otherwise it does nothing.
 */
export function noteIfSiteUpdated(error: unknown): boolean {
  if (!unstable_isUnrecognizedActionError(error)) return false;
  window.dispatchEvent(new Event(SITE_UPDATED_EVENT));
  return true;
}

/** The sentence to show for a caught action error. */
export function describeActionError(error: unknown, fallback: string): string {
  if (noteIfSiteUpdated(error)) return SITE_UPDATED_MESSAGE;
  return error instanceof Error ? error.message : fallback;
}
