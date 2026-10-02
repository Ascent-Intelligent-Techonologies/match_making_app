"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Copy, MessageCircleMore } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { ACCESS_LEVEL_OPTIONS } from "@/lib/constants";
import { createShareLinkAction, type ShareLinkFormState } from "@/lib/actions/share-links";

export interface ClientOption {
  id: string;
  full_name: string;
  phone_display: string | null;
  phone: string;
}

export function ShareLinkCreator({
  allProfiles,
  preselectedIds = [],
  defaultExpiryDays,
  lockSelection = false,
  existingClients = [],
  fixedClient,
}: {
  allProfiles: { id: string; full_name: string; city: string | null }[];
  preselectedIds?: string[];
  defaultExpiryDays: number;
  /** Lets the admin reuse a client instead of retyping their details. */
  existingClients?: ClientOption[];
  /** When the client is already decided (e.g. searching on their behalf). */
  fixedClient?: { full_name: string; phone: string };
  /**
   * When true the profile picker is hidden and `preselectedIds` is the
   * definitive selection — used when profiles were already chosen elsewhere
   * (e.g. selected from the filtered dashboard grid).
   */
  lockSelection?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ShareLinkFormState, FormData>(
    createShareLinkAction,
    {}
  );
  const [ownSelection, setOwnSelection] = useState<Set<string>>(new Set(preselectedIds));
  const [copied, setCopied] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");

  // In locked mode the parent owns the selection, so read it straight from
  // props — otherwise it would go stale as the parent's selection changes.
  const selected = useMemo(
    () => (lockSelection ? new Set(preselectedIds) : ownSelection),
    [lockSelection, preselectedIds, ownSelection]
  );

  const selectedProfiles = useMemo(
    () => allProfiles.filter((p) => selected.has(p.id)),
    [allProfiles, selected]
  );

  const whatsappText = useMemo(() => {
    if (!state.createdUrl) return "";
    const names = selectedProfiles.map((p) => p.full_name).join(", ");
    const greeting = state.clientName ? `Hi ${state.clientName}, ` : "";
    return encodeURIComponent(
      `${greeting}sharing the profile${selectedProfiles.length > 1 ? "s" : ""} for ${names} from AnuRupa Matrimony: ${state.createdUrl}`
    );
  }, [state.createdUrl, state.clientName, selectedProfiles]);

  if (state.createdUrl) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-gold-400/40 bg-blush-100/70 p-4">
        <p className="text-sm font-medium text-maroon-700">
          Share link created
          {selectedProfiles.length > 1 ? ` · ${selectedProfiles.length} profiles` : ""}
        </p>
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
      {lockSelection ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
            Sharing {selectedProfiles.length} profile{selectedProfiles.length === 1 ? "" : "s"}
          </p>
          {/* The picker is hidden here, so the chosen ids ride along as hidden inputs. */}
          {selectedProfiles.map((p) => (
            <input key={p.id} type="hidden" name="profileIds" value={p.id} />
          ))}
          <div className="max-h-32 overflow-y-auto rounded-lg border border-blush-200 bg-white/60 p-2 text-sm text-ink-900/70">
            {selectedProfiles.map((p) => p.full_name).join(", ")}
          </div>
        </div>
      ) : (
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
                  checked={ownSelection.has(p.id)}
                  onChange={(e) => {
                    const next = new Set(ownSelection);
                    if (e.target.checked) next.add(p.id);
                    else next.delete(p.id);
                    setOwnSelection(next);
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
      )}

      {fixedClient ? (
        <div className="flex flex-col gap-1 rounded-lg border border-blush-200 bg-blush-100/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
            Sharing on behalf of
          </p>
          <p className="text-sm text-ink-900">
            {fixedClient.full_name} · {fixedClient.phone}
          </p>
          <input type="hidden" name="clientName" value={fixedClient.full_name} />
          <input type="hidden" name="clientPhone" value={fixedClient.phone} />
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-blush-200 bg-blush-100/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
            Sharing on behalf of (optional)
          </p>
          <p className="-mt-1 text-xs text-ink-900/50">
            Leave blank and whoever opens the link is asked for their name and number
            before they can shortlist.
          </p>
          {existingClients.length > 0 && (
            <Field label="Pick an existing client (optional)" htmlFor="existingClient">
              <Select
                id="existingClient"
                value=""
                onChange={(e) => {
                  const match = existingClients.find((c) => c.id === e.target.value);
                  if (match) {
                    setClientName(match.full_name);
                    setClientPhone(match.phone_display ?? match.phone);
                  }
                }}
              >
                <option value="">New client…</option>
                {existingClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name} · {c.phone_display ?? c.phone}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client name" htmlFor="clientName">
              <Input
                id="clientName"
                name="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Sharma family"
              />
            </Field>
            <Field label="Client phone" htmlFor="clientPhone">
              <Input
                id="clientPhone"
                name="clientPhone"
                inputMode="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
              />
            </Field>
          </div>
        </div>
      )}

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
