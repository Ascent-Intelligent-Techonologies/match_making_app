"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Copy, MessageCircleMore } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { ACCESS_LEVEL_OPTIONS } from "@/lib/constants";
import { createShareLinkAction, type ShareLinkFormState } from "@/lib/actions/share-links";

export function ShareLinkCreator({
  allProfiles,
  preselectedIds = [],
  defaultExpiryDays,
}: {
  allProfiles: { id: string; full_name: string; city: string | null }[];
  preselectedIds?: string[];
  defaultExpiryDays: number;
}) {
  const [state, formAction, pending] = useActionState<ShareLinkFormState, FormData>(
    createShareLinkAction,
    {}
  );
  const [selected, setSelected] = useState<Set<string>>(new Set(preselectedIds));
  const [copied, setCopied] = useState(false);

  const whatsappText = useMemo(() => {
    if (!state.createdUrl) return "";
    const names = allProfiles
      .filter((p) => selected.has(p.id))
      .map((p) => p.full_name)
      .join(", ");
    return encodeURIComponent(
      `Sharing the profile${selected.size > 1 ? "s" : ""} for ${names} from Aura: ${state.createdUrl}`
    );
  }, [state.createdUrl, allProfiles, selected]);

  if (state.createdUrl) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-gold-400/40 bg-blush-100/70 p-4">
        <p className="text-sm font-medium text-maroon-700">Share link created</p>
        <code className="break-all rounded-lg bg-white/70 px-3 py-2 text-xs text-ink-900">
          {state.createdUrl}
        </code>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(state.createdUrl!);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <a
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            <MessageCircleMore size={16} />
            Share on WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-gold-400/25 bg-white/50 p-4">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
          Profiles to include
        </p>
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-blush-200 bg-white/60 p-2">
          {allProfiles.map((p) => (
            <label key={p.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-blush-100">
              <input
                type="checkbox"
                name="profileIds"
                value={p.id}
                checked={selected.has(p.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(p.id);
                  else next.delete(p.id);
                  setSelected(next);
                }}
                className="h-4 w-4 rounded border-blush-300 text-maroon-600 focus:ring-maroon-600"
              />
              <span>
                {p.full_name}
                {p.city ? ` · ${p.city}` : ""}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Access Level" htmlFor="accessLevel">
          <Select id="accessLevel" name="accessLevel" defaultValue="partial">
            {ACCESS_LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Expires In (days)" htmlFor="expiryDays">
          <Input id="expiryDays" name="expiryDays" type="number" min={1} max={90} defaultValue={defaultExpiryDays} />
        </Field>
        <Field label="Label (optional)" htmlFor="label">
          <Input id="label" name="label" placeholder="e.g. Sharma family" />
        </Field>
      </div>

      {state.error && <p className="text-xs text-red-700">{state.error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || selected.size === 0}>
          {pending ? "Generating…" : "Generate share link"}
        </Button>
      </div>
    </form>
  );
}
