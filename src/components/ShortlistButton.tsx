"use client";

import { useState } from "react";
import { Heart, X } from "lucide-react";
import { Input } from "@/components/ui/Field";
import {
  toggleShortlistAction,
  identifyAndShortlistAction,
} from "@/lib/actions/shortlists";

/**
 * The client-facing heart on a shared profile.
 *
 * A share link can be forwarded, so we do not assume the person reading it is
 * the person it was sent to. The first time someone shortlists we ask who they
 * are, then apply the shortlist they just asked for. After that the heart
 * works in one tap for the rest of their visit.
 */
export function ShortlistButton({
  token,
  profileId,
  initialShortlisted,
  needsIdentity,
}: {
  token: string;
  profileId: string;
  initialShortlisted: boolean;
  /** True until the viewer has told us who they are. */
  needsIdentity: boolean;
}) {
  const [shortlisted, setShortlisted] = useState(initialShortlisted);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  async function onHeartClick() {
    if (busy) return;
    setError(null);

    if (needsIdentity) {
      setAsking(true);
      return;
    }

    const optimistic = !shortlisted;
    setShortlisted(optimistic);
    setBusy(true);
    const result = await toggleShortlistAction(token, profileId);
    setBusy(false);

    if (result.needsIdentity) {
      setShortlisted(!optimistic);
      setAsking(true);
    } else if (result.error) {
      setShortlisted(!optimistic);
      setError(result.error);
    } else if (typeof result.shortlisted === "boolean") {
      setShortlisted(result.shortlisted);
    }
  }

  async function onIdentify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await identifyAndShortlistAction(token, profileId, fullName, phone);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (typeof result.shortlisted === "boolean") setShortlisted(result.shortlisted);
    setAsking(false);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={onHeartClick}
        disabled={busy}
        aria-pressed={shortlisted}
        aria-label={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
        className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
          shortlisted
            ? "border-maroon-600 bg-maroon-600 text-blush-50"
            : "border-gold-400 bg-white/70 text-maroon-700 hover:bg-blush-100"
        }`}
      >
        <Heart size={18} fill={shortlisted ? "currentColor" : "none"} />
        <span>{shortlisted ? "Shortlisted" : "Shortlist"}</span>
      </button>

      {asking && (
        <form
          onSubmit={onIdentify}
          className="w-full min-w-[240px] max-w-xs rounded-xl border border-gold-400/40 bg-blush-100/70 p-3"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-maroon-700">
              Tell us who you are, and we will save this profile for you.
            </p>
            <button
              type="button"
              aria-label="Cancel"
              onClick={() => {
                setAsking(false);
                setError(null);
              }}
              className="shrink-0 rounded-full p-1 text-maroon-700/60 hover:bg-white/70"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <Input
              aria-label="Your name"
              placeholder="Your name"
              required
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <Input
              aria-label="Mobile number"
              placeholder="Mobile number"
              inputMode="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-maroon-600 px-4 py-2 text-sm font-medium text-blush-50 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save & shortlist"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="max-w-xs text-right text-xs text-red-700">{error}</p>}
    </div>
  );
}
