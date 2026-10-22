"use client";

import { ErrorPanel } from "@/components/ErrorPanel";

/** For the public pages (browse, share) and anything outside the admin area, which has its own. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPanel error={error} reset={reset} />;
}
