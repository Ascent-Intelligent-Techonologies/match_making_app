import Image from "next/image";
import { getShareLinkByToken } from "@/lib/data/share-links";
import { getManyProfilesWithPhotos } from "@/lib/data/profiles";
import { getShortlistedProfileIds } from "@/lib/data/shortlists";
import { toPublicProfile } from "@/lib/types";
import { ClientProfileCard } from "@/components/ClientProfileCard";
import { ShareViewTracker } from "@/components/ShareViewTracker";
import { getBrowsingClientId } from "@/lib/auth/client-session";

function LinkNotice({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-serif text-4xl font-semibold text-olive-500">AnuRupa Matrimony</p>
      <h1 className="font-serif text-2xl font-semibold text-maroon-700">{message}</h1>
      <p className="max-w-sm text-sm text-ink-900/60">
        Please reach out to your AnuRupa matchmaking consultant for a fresh link.
      </p>
    </main>
  );
}

export default async function SharePage({ params }: PageProps<"/share/[token]">) {
  const { token } = await params;
  const link = await getShareLinkByToken(token);

  if (!link) {
    return <LinkNotice message="This link could not be found." />;
  }
  if (link.revoked) {
    return <LinkNotice message="This link has been revoked." />;
  }

  const profiles = await getManyProfilesWithPhotos(link.profiles.map((p) => p.id));
  const publicProfiles = profiles.map((p) => toPublicProfile(p, link.access_level));

  // A link the admin attributed to a client belongs to that client. One sent
  // without client details asks whoever opens it before they can shortlist.
  const shortlistClientId = link.client_id ?? (await getBrowsingClientId());
  const shortlistedIds = shortlistClientId
    ? new Set(await getShortlistedProfileIds(shortlistClientId))
    : new Set<string>();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <ShareViewTracker token={token} />

      <header className="flex flex-col items-center gap-2 text-center">
        <div className="relative aspect-square w-full max-w-[120px] overflow-hidden rounded-2xl shadow-sm sm:max-w-[180px]">
          <Image
            src="/logo-anurupa.jpg"
            alt="AnuRupa Matrimony — Where destiny aligns"
            fill
            sizes="(max-width: 640px) 120px, 180px"
            className="object-cover"
          />
        </div>
        <p className="max-w-sm text-sm text-ink-900/60">
          Tap the heart on any profile you would like to take forward.
        </p>
      </header>

      {/* The consultant's note to this family, written when the link was made. */}
      {link.notes && (
        <section className="rounded-2xl border border-gold-400/40 bg-blush-100/60 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-maroon-700/70">
            A note from AnuRupa
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-900/80">
            {link.notes}
          </p>
        </section>
      )}

      <div className="flex flex-col gap-6">
        {publicProfiles.map((profile) => (
          <ClientProfileCard
            key={profile.id}
            profile={profile}
            shortlist={{
              token,
              shortlisted: shortlistedIds.has(profile.id),
              needsIdentity: !shortlistClientId,
            }}
          />
        ))}
      </div>
    </main>
  );
}
