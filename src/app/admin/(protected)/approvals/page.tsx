import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ImageOff, MapPin, Phone, TriangleAlert } from "lucide-react";
import { listProfilesByApproval } from "@/lib/data/profiles";
import { findApprovalMatches, hasMatches, type ApprovalMatches } from "@/lib/data/duplicates";
import { coverTileUrl, getCoverPhotoUrls, type CoverUrls } from "@/lib/data/photos";
import { approveProfileAction, rejectProfileAction } from "@/lib/actions/approvals";
import { ApprovalButtons } from "@/components/ApprovalButtons";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AUTO_FRAMING, framingStyle } from "@/lib/framing";
import { calculateAge, formatDate, formatLocation, formatRelativeDays } from "@/lib/format";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Approvals | AnuRupa Admin" };

function ApprovalRow({
  profile,
  cover,
  matches,
  declined,
}: {
  profile: Profile;
  cover: CoverUrls | undefined;
  matches: ApprovalMatches;
  declined?: boolean;
}) {
  const onFile = hasMatches(matches);
  const name = [profile.full_name, profile.surname].filter(Boolean).join(" ");
  const age = calculateAge(profile.dob);
  const location = formatLocation(profile);
  const photo = coverTileUrl(cover);
  const href = `/admin/profiles/${profile.id}`;

  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <Link
        href={href}
        className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-blush-100"
      >
        {photo ? (
          <Image
            src={photo}
            alt={name}
            fill
            sizes="80px"
            className="object-cover"
            style={framingStyle(cover?.framing ?? AUTO_FRAMING)}
            unoptimized
          />
        ) : (
          <span className="flex h-full items-center justify-center text-maroon-700/30">
            <ImageOff size={20} strokeWidth={1.25} />
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href} className="font-serif text-lg font-semibold text-maroon-700 hover:underline">
            {name}
          </Link>
          {declined && <Badge tone="neutral">Declined</Badge>}
        </div>

        <p className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-ink-900/70">
          {profile.contact_phone && (
            <span className="flex items-center gap-1.5">
              <Phone size={13} /> {profile.contact_phone}
            </span>
          )}
          {(age || profile.dob) && (
            <span>
              {profile.dob ? formatDate(profile.dob) : ""}
              {age ? ` · ${age} yrs` : ""}
            </span>
          )}
          {location && (
            <span className="flex items-center gap-1.5">
              <MapPin size={13} /> {location}
            </span>
          )}
        </p>

        <p className="text-xs text-ink-900/50">
          {declined
            ? `Declined ${formatRelativeDays(profile.reviewed_at)}`
            : `Submitted ${formatRelativeDays(profile.submitted_at)}`}
        </p>

        {onFile && (
          <div className="mt-1 flex flex-col gap-0.5 text-xs text-red-700">
            <p className="flex items-center gap-1.5 font-semibold">
              <TriangleAlert size={13} /> This number is already on file
            </p>
            {matches.client && (
              <p>
                Client: <span className="font-medium">{matches.client.full_name}</span>
              </p>
            )}
            {matches.profiles.map((m) => (
              <p key={m.id}>
                Profile:{" "}
                <Link href={`/admin/profiles/${m.id}`} className="font-medium underline">
                  {[m.full_name, m.surname].filter(Boolean).join(" ")}
                </Link>
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-start gap-2">
        <Link
          href={href}
          className="text-sm font-medium text-maroon-700 hover:underline"
        >
          {onFile ? "Review, choose and approve" : "Review all details"}
        </Link>
        <ApprovalButtons
          approve={onFile ? undefined : approveProfileAction.bind(null, profile.id)}
          reject={declined ? undefined : rejectProfileAction.bind(null, profile.id)}
          approveLabel={declined ? "Approve instead" : "Approve"}
        />
      </div>
    </Card>
  );
}

export default async function ApprovalsPage() {
  const [pending, declined] = await Promise.all([
    listProfilesByApproval("pending"),
    listProfilesByApproval("rejected"),
  ]);

  const [covers, matches, declinedMatches] = await Promise.all([
    getCoverPhotoUrls([...pending, ...declined].map((p) => p.id)),
    Promise.all(pending.map((p) => findApprovalMatches(p))),
    Promise.all(declined.map((p) => findApprovalMatches(p))),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-maroon-700/70 hover:text-maroon-700"
        >
          <ArrowLeft size={15} /> Back
        </Link>
        <h1 className="font-serif text-3xl font-semibold text-maroon-700">Approvals</h1>
        <p className="max-w-2xl text-sm text-ink-900/60">
          Profiles people have filled in themselves. Nothing here is in Search, All
          Profiles or the client list until you approve it. Open one to read everything
          they entered, and to correct or add to it before you approve.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-xl font-semibold text-maroon-700">
          Waiting for approval ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gold-400/40 bg-white/40 p-8 text-center text-sm text-ink-900/50">
            Nothing is waiting for approval.
          </p>
        ) : (
          pending.map((p, i) => (
            <ApprovalRow key={p.id} profile={p} cover={covers.get(p.id)} matches={matches[i]} />
          ))
        )}
      </section>

      {declined.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-xl font-semibold text-maroon-700">
            Declined ({declined.length})
          </h2>
          <p className="text-sm text-ink-900/60">
            Kept in case you change your mind. Delete one from its own page to remove it for good.
          </p>
          {declined.map((p, i) => (
            <ApprovalRow key={p.id} profile={p} cover={covers.get(p.id)} matches={declinedMatches[i]} declined />
          ))}
        </section>
      )}
    </div>
  );
}
