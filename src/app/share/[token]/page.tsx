import Image from "next/image";
import { getShareLinkByToken } from "@/lib/data/share-links";
import { getManyProfilesWithPhotos } from "@/lib/data/profiles";
import { getShortlistedProfileIds } from "@/lib/data/shortlists";
import { toPublicProfile } from "@/lib/types";
import { ClientProfileCard } from "@/components/ClientProfileCard";
import { ShareViewTracker } from "@/components/ShareViewTracker";
import { getBrowsingClientId } from "@/lib/auth/client-session";

function ExpiredNotice({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-serif text-4xl font-semibold text-olive-500">AURA</p>
      <h1 className="font-serif text-2xl font-semibold text-maroon-700">{message}</h1>
      <p className="max-w-sm text-sm text-ink-900/60">
        Please reach out to your Aura matchmaking consultant for a fresh link.
      </p>
    </main>
  );
}

export default async function SharePage({ params }: PageProps<"/share/[token]">) {
  const { token } = await params;
  const link = await getShareLinkByToken(token);

  if (!link) {
    return <ExpiredNotice message="This link could not be found." />;
  }
  if (link.revoked) {
    return <ExpiredNotice message="This link has been revoked." />;
  }
  if (new Date(link.expires_at) < new Date()) {
    return <ExpiredNotice message="This link has expired." />;
  }

  const profiles = await getManyProfilesWithPhotos(link.profiles.map((p) => p.id));
  const publicProfiles = profiles.map((p) => toPublicProfile(p, link.access_level));

  // Whoever is reading this link may not be who it was sent to, so hearts are
  // keyed to the viewer once they identify themselves — not to link.client_id.
  const viewerClientId = await getBrowsingClientId();
  const shortlistedIds = viewerClientId
    ? new Set(await getShortlistedProfileIds(viewerClientId))
    : new Set<string>();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <ShareViewTracker token={token} />

      <header className="flex flex-col items-center gap-2 text-center">
        <div className="relative aspect-square w-full max-w-[120px] overflow-hidden rounded-2xl shadow-sm sm:max-w-[180px]">
          <Image
            src="/logo.png"
            alt="Aura — Where destiny aligns"
            fill
            sizes="(max-width: 640px) 120px, 180px"
            className="object-cover"
          />
        </div>
        <p className="max-w-sm text-sm text-ink-900/60">
          Tap the heart on any profile you would like to take forward.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {publicProfiles.map((profile) => (
          <ClientProfileCard
            key={profile.id}
            profile={profile}
            shortlist={{
              token,
              shortlisted: shortlistedIds.has(profile.id),
              needsIdentity: !viewerClientId,
            }}
          />
        ))}
      </div>
    </main>
  );
}
