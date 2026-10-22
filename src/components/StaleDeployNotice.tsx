"use client";

import { useEffect, useState } from "react";
import { unstable_isUnrecognizedActionError } from "next/navigation";
import { SITE_UPDATED_EVENT } from "@/lib/stale-deploy";

/**
 * A banner across the top of the page once something has shown it is older
 * than the site: raised by a component that caught the error (see
 * noteIfSiteUpdated) or by one that did not catch it at all.
 */
export function StaleDeployNotice() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const raise = () => setStale(true);
    const onRejection = (event: PromiseRejectionEvent) => {
      if (!unstable_isUnrecognizedActionError(event.reason)) return;
      event.preventDefault();
      setStale(true);
    };
    window.addEventListener(SITE_UPDATED_EVENT, raise);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener(SITE_UPDATED_EVENT, raise);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (!stale) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[60] flex flex-wrap items-center justify-center gap-3 bg-maroon-700 px-4 py-3 text-sm text-blush-50 shadow-lg"
    >
      <span>
        The site was updated while this page was open, so that did not go through.
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="cursor-pointer rounded-full bg-blush-50 px-4 py-1.5 text-sm font-medium text-maroon-700 hover:bg-white"
      >
        Reload the page
      </button>
    </div>
  );
}
