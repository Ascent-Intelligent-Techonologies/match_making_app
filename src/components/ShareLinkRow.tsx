"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Ban, CalendarPlus, Copy, MessageCircleMore, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import type { ShareLinkWithProfiles } from "@/lib/types";
import {
  revokeShareLinkAction,
  extendShareLinkAction,
  deleteShareLinkAction,
} from "@/lib/actions/share-links";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";

export function ShareLinkRow({ link, siteUrl }: { link: ShareLinkWithProfiles; siteUrl: string }) {
  const [pending, startTransition] = useTransition();
  const url = `${siteUrl}/share/${link.token}`;
  const expired = new Date(link.expires_at) < new Date();
  const isLive = !link.revoked && !expired;

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
      </td>
      <td className="py-3 pr-4">
        <Badge tone={link.access_level === "full" ? "maroon" : "gold"}>{link.access_level}</Badge>
      </td>
      <td className="py-3 pr-4 text-sm">
        {isLive ? (
          <Badge tone="olive">Active</Badge>
        ) : link.revoked ? (
          <Badge tone="danger">Revoked</Badge>
        ) : (
          <Badge tone="neutral">Expired</Badge>
        )}
      </td>
      <td className="py-3 pr-4 text-sm text-ink-900/70">{formatDate(link.expires_at)}</td>
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
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => startTransition(() => extendShareLinkAction(link.id, 3))}
          >
            <CalendarPlus size={13} /> +3 days
          </Button>
          {!link.revoked && (
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
              isLive
                ? "Deletes this link. Anyone holding it loses access immediately."
                : "Deletes this link and its record."
            }
          />
        </div>
      </td>
    </tr>
  );
}
