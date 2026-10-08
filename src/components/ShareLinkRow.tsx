"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Ban, Copy, MessageCircleMore, Pencil, RotateCcw, StickyNote, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/Field";
import { formatDate } from "@/lib/format";
import type { ShareLinkWithProfiles } from "@/lib/types";
import {
  revokeShareLinkAction,
  restoreShareLinkAction,
  deleteShareLinkAction,
  updateShareLinkNotesAction,
} from "@/lib/actions/share-links";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

export function ShareLinkRow({ link, siteUrl }: { link: ShareLinkWithProfiles; siteUrl: string }) {
  const [pending, startTransition] = useTransition();
  const [editingNotes, setEditingNotes] = useState(false);
  const url = `${siteUrl}/share/${link.token}`;

  const whatsappText = encodeURIComponent(
    `Sharing the profile${link.profiles.length > 1 ? "s" : ""} for ${link.profiles
      .map((p) => p.full_name)
      .join(", ")} from AnuRupa Matrimony: ${url}`
  );

  return (
    <tr className="border-b border-blush-200 last:border-0">
      <td className="py-3 pr-4">
        <p className="font-medium text-ink-900">
          {link.label || link.profiles.map((p) => p.full_name).join(", ")}
        </p>
        <p className="text-xs text-ink-900/50">{link.profiles.map((p) => p.full_name).join(", ")}</p>
        {link.client && (
          <Link
            href={`/admin/clients/${link.client.id}`}
            className="mt-1 inline-flex items-center gap-1 text-xs text-maroon-700 hover:underline"
          >
            <User size={11} />
            {link.client.full_name}
            {link.client.phone_display ? ` · ${link.client.phone_display}` : ""}
          </Link>
        )}

        {/* The note is part of what the family sees, so it is shown here in
            full rather than truncated, and stays editable after sending. */}
        {editingNotes ? (
          <form
            action={updateShareLinkNotesAction.bind(null, link.id)}
            onSubmit={() => setEditingNotes(false)}
            className="mt-2 flex max-w-sm flex-col gap-2"
          >
            <Textarea
              name="notes"
              rows={3}
              maxLength={2000}
              defaultValue={link.notes ?? ""}
              placeholder="Note shown to the family above the profiles"
              className="text-xs"
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Save note
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setEditingNotes(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : link.notes ? (
          <div className="mt-2 max-w-sm rounded-lg border border-gold-400/30 bg-blush-100/60 px-2.5 py-2">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-maroon-700/70">
              <StickyNote size={11} /> Note to family
            </p>
            <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink-900/80">{link.notes}</p>
            <button
              type="button"
              onClick={() => setEditingNotes(true)}
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-maroon-700 hover:underline"
            >
              <Pencil size={10} /> Edit
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingNotes(true)}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-maroon-700 hover:underline"
          >
            <StickyNote size={11} /> Add a note
          </button>
        )}
      </td>
      <td className="py-3 pr-4">
        <Badge tone={link.access_level === "full" ? "maroon" : "gold"}>{link.access_level}</Badge>
      </td>
      <td className="py-3 pr-4 text-sm">
        {link.revoked ? <Badge tone="danger">Revoked</Badge> : <Badge tone="olive">Active</Badge>}
      </td>
      <td className="py-3 pr-4 text-sm text-ink-900/70">{formatDate(link.created_at)}</td>
      <td className="py-3 pr-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => navigator.clipboard.writeText(url)}
          >
            <Copy size={13} /> Copy
          </Button>
          <a
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            <MessageCircleMore size={13} /> WhatsApp
          </a>
          {link.revoked ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => startTransition(() => restoreShareLinkAction(link.id))}
            >
              <RotateCcw size={13} /> Restore
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() => startTransition(() => revokeShareLinkAction(link.id))}
            >
              <Ban size={13} /> Revoke
            </Button>
          )}
          {/* Revoke keeps the row and turns the link off; delete removes the
              record entirely, for links sent by mistake. */}
          <ConfirmDeleteButton
            action={deleteShareLinkAction.bind(null, link.id)}
            confirmLabel="Delete link"
            description={
              link.revoked
                ? "Deletes this link and its record."
                : "Deletes this link. Anyone holding it loses access immediately."
            }
          />
        </div>
      </td>
    </tr>
  );
}
