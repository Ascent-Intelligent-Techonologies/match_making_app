import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Previous / next over a filtered list.
 *
 * Page is a URL parameter rather than component state so a particular page can
 * be linked to, reloaded and gone back to — and so the server renders only the
 * rows that page needs.
 */
export function Pager({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  /** The current filters, carried across so paging never drops them. */
  params: Record<string, string | string[] | undefined>;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  function href(target: number) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "page" || value === undefined) continue;
      search.set(key, Array.isArray(value) ? (value[0] ?? "") : value);
    }
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  const linkClass =
    "inline-flex items-center gap-1.5 rounded-full border border-gold-400 px-4 py-2 text-sm font-medium text-maroon-700 hover:bg-blush-100";
  const disabledClass =
    "inline-flex items-center gap-1.5 rounded-full border border-blush-200 px-4 py-2 text-sm font-medium text-ink-900/30";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink-900/60">
        Showing <b>{first.toLocaleString()}–{last.toLocaleString()}</b> of{" "}
        <b>{total.toLocaleString()}</b>
      </p>

      {lastPage > 1 && (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={href(page - 1)} className={linkClass}>
              <ChevronLeft size={15} /> Previous
            </Link>
          ) : (
            <span className={disabledClass}>
              <ChevronLeft size={15} /> Previous
            </span>
          )}
          <span className="text-sm text-ink-900/60">
            Page {page} of {lastPage}
          </span>
          {page < lastPage ? (
            <Link href={href(page + 1)} className={linkClass}>
              Next <ChevronRight size={15} />
            </Link>
          ) : (
            <span className={disabledClass}>
              Next <ChevronRight size={15} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Reads `?page=` defensively; anything odd means page one. */
export function pageFromParams(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
