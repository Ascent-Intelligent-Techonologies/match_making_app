import Link from "next/link";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { coverTileUrl, type CoverUrls } from "@/lib/data/photos";
import { deleteClientMatchAction } from "@/lib/actions/client-matches";
import type { ClientMatchRow } from "@/lib/data/client-matches";
import { describeProfile, fullName } from "@/lib/client-match";
import { AUTO_FRAMING, framingStyle } from "@/lib/framing";
import { formatDateTime } from "@/lib/format";

/** One side of a pair: photo, name, a line about them, and a way to open the profile. */
function ProfileCell({
  profile,
  cover,
}: {
  profile: ClientMatchRow["boy"];
  cover: CoverUrls | undefined;
}) {
  const name = fullName(profile);
  const photo = coverTileUrl(cover);

  return (
    <Link href={`/admin/profiles/${profile.id}`} className="flex items-center gap-3 hover:underline">
      <span className="relative h-14 w-11 shrink-0 overflow-hidden rounded-md bg-blush-100">
        {photo ? (
          <Image
            src={photo}
            alt={name}
            fill
            sizes="44px"
            className="object-cover"
            style={framingStyle(cover?.framing ?? AUTO_FRAMING)}
            unoptimized
          />
        ) : (
          <span className="flex h-full items-center justify-center text-maroon-700/30">
            <ImageOff size={16} strokeWidth={1.25} />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-medium text-maroon-700">{name}</span>
        <span className="text-xs text-ink-900/55">{describeProfile(profile) || "—"}</span>
        {profile.deleted_at && (
          <Badge tone="neutral" className="mt-1 w-fit">
            Deleted profile
          </Badge>
        )}
      </span>
    </Link>
  );
}

/**
 * The pairs in communication, newest first. A plain server-rendered table: the
 * only interactive part is each row's delete, which arms in place and asks once.
 */
export function ClientMatchTable({
  matches,
  covers,
}: {
  matches: ClientMatchRow[];
  covers: Map<string, CoverUrls>;
}) {
  if (matches.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gold-400/40 bg-white/40 p-10 text-center text-sm text-ink-900/50">
        No pairs are in communication yet. Use &ldquo;Add new row&rdquo; to add the first.
      </p>
    );
  }

  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-blush-200 text-[11px] uppercase tracking-wider text-maroon-700/60">
            <th className="px-4 py-3 font-semibold">Boy</th>
            <th className="px-4 py-3 font-semibold">Girl</th>
            <th className="px-4 py-3 font-semibold">Notes</th>
            <th className="px-4 py-3 font-semibold">Created</th>
            <th className="px-4 py-3">
              <span className="sr-only">Delete</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.id} className="border-b border-blush-200/70 align-top last:border-b-0">
              <td className="px-4 py-3">
                <ProfileCell profile={m.boy} cover={covers.get(m.boy.id)} />
              </td>
              <td className="px-4 py-3">
                <ProfileCell profile={m.girl} cover={covers.get(m.girl.id)} />
              </td>
              <td className="max-w-xs whitespace-pre-line px-4 py-3 text-ink-900/80">
                {m.notes ?? <span className="text-ink-900/30">—</span>}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-ink-900/70">
                {formatDateTime(m.created_at)}
              </td>
              <td className="px-4 py-3 text-right">
                <ConfirmDeleteButton
                  action={deleteClientMatchAction.bind(null, m.id)}
                  label="Delete this row"
                  confirmLabel="Yes, delete"
                  description="Removes this pair from the list. The two profiles are not touched."
                  iconOnly
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
