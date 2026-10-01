"use client";

import { useEffect, useRef } from "react";
import { recordShareViewAction } from "@/lib/actions/share-views";

/** Fires once per page load to mark the link as opened by the client. */
export function ShareViewTracker({ token }: { token: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void recordShareViewAction(token);
  }, [token]);

  return null;
}
