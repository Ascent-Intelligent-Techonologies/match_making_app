/**
 * What a page shows the instant it is asked for, before the server has
 * finished its queries.
 *
 * Every page here is rendered on request, and Next cannot show anything of a
 * page like that until the server answers. A `loading.tsx` next to it is what
 * gets shown in the meantime; without one, a click appeared to do nothing for
 * as long as the queries took.
 */
export function PageSkeleton({
  variant = "list",
  contained = false,
}: {
  /** A heading, a filter panel and a grid of cards; or a photo beside details. */
  variant?: "list" | "detail";
  /** Adds the page's own width and padding, for pages whose layout has none. */
  contained?: boolean;
}) {
  const block = "animate-pulse rounded-xl bg-blush-100";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-page-loading
      className={`flex flex-col gap-6 ${
        contained ? "mx-auto w-full max-w-6xl px-6 py-10" : ""
      }`}
    >
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-2">
        <div className={`${block} h-8 w-56`} />
        <div className={`${block} h-4 w-72 max-w-full`} />
      </div>

      {variant === "list" ? (
        <>
          <div className={`${block} h-36 w-full`} />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`${block} h-64`} />
            ))}
          </div>
        </>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className={`${block} aspect-[4/5] w-full`} />
          <div className="flex flex-col gap-3">
            <div className={`${block} h-6 w-3/4`} />
            <div className={`${block} h-4 w-1/2`} />
            <div className={`${block} h-4 w-2/3`} />
            <div className={`${block} h-4 w-1/3`} />
          </div>
        </div>
      )}
    </div>
  );
}
