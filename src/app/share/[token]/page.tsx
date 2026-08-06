import Image from "next/image";
import { getShareLinkByToken } from "@/lib/data/share-links";
import { getManyProfilesWithPhotos } from "@/lib/data/profiles";
import { toPublicProfile } from "@/lib/types";
import { ClientProfileCard } from "@/components/ClientProfileCard";

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

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col items-center gap-2 text-center">
        <div className="relative h-16 w-16 overflow-hidden rounded-full border border-gold-400/40 bg-blush-100">
          <Image src="/logo.png" alt="Aura" fill className="object-cover" />
        </div>
        <p className="font-serif text-3xl font-semibold text-olive-500">AURA</p>
        <p className="font-script text-lg italic text-maroon-700">Where destiny aligns</p>
      </header>

      <div className="flex flex-col gap-6">
        {publicProfiles.map((profile) => (
          <ClientProfileCard key={profile.id} profile={profile} />
        ))}
      </div>
    </main>
  );
}
