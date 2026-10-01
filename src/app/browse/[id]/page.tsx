import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getProfileWithPhotos } from "@/lib/data/profiles";
import { toPublicProfile } from "@/lib/types";
import { ClientProfileCard } from "@/components/ClientProfileCard";
import { BrowseGate } from "@/components/BrowseGate";
import { BrowseShortlistButton } from "@/components/BrowseShortlistButton";
import { getBrowsingClientId } from "@/lib/auth/client-session";
import { getShortlistedProfileIds } from "@/lib/data/shortlists";

export default async function PublicProfileDetailPage({
  params,
}: PageProps<"/browse/[id]">) {
  const clientId = await getBrowsingClientId();
  if (!clientId) return <BrowseGate />;

  const { id } = await params;
  const profile = await getProfileWithPhotos(id);

  if (!profile || !profile.is_active) notFound();

  const publicProfile = toPublicProfile(profile, "partial");
  const shortlisted = (await getShortlistedProfileIds(clientId)).includes(profile.id);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <Link
        href="/browse"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-maroon-700/70 hover:text-maroon-700"
      >
        <ArrowLeft size={15} /> Back to all profiles
      </Link>

      <div className="relative">
        <BrowseShortlistButton profileId={profile.id} initialShortlisted={shortlisted} />
        <ClientProfileCard profile={publicProfile} />
      </div>

      <p className="text-center text-sm text-ink-900/50">
        Interested in this profile? Contact your Aura matchmaking consultant for a full
        introduction.
      </p>
    </main>
  );
}
