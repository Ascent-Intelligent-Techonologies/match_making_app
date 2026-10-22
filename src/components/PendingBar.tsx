/**
 * A thin sliding bar along the top edge of a filter panel while the list under
 * it is being fetched. The panel must be `relative`.
 *
 * Changing a filter only changes the URL's query string, which Next treats as
 * the same page, so `loading.tsx` never shows for it; the list just sat there
 * until the new one arrived. This is the "something is happening" signal.
 */
export function PendingBar() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-4 top-0 h-0.5 overflow-hidden rounded-full"
    >
      <div className="pending-bar h-full w-1/3 rounded-full bg-maroon-600" />
    </div>
  );
}
