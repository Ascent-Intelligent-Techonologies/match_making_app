"use client";

import { unstable_isUnrecognizedActionError } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * The body of an error page. The usual cause is a page that was open across a
 * deploy: its buttons still point at the previous build's server actions,
 * which the new server no longer has. That gets a plain "reload", not Next's
 * generic "this page couldn't load".
 */
export function ErrorPanel({ error, reset }: { error: Error; reset: () => void }) {
  const outdated = unstable_isUnrecognizedActionError(error);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center"
    >
      <h1 className="font-serif text-2xl font-semibold text-maroon-700">
        {outdated ? "This page is out of date" : "Something went wrong"}
      </h1>
      <p className="text-sm text-ink-900/70">
        {outdated
          ? "The site was updated while this page was open. Reload it to carry on; anything you had not saved on this page is not kept."
          : "That did not work. Reloading usually fixes it; if it keeps happening, tell us what you were doing."}
      </p>
      <div className="flex gap-2">
        <Button type="button" onClick={() => window.location.reload()}>
          Reload the page
        </Button>
        {!outdated && (
          <Button type="button" variant="secondary" onClick={reset}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
