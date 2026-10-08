import { notFound } from "next/navigation";
import { getProfileWithPhotos } from "@/lib/data/profiles";
import { listProfiles } from "@/lib/data/profiles";
import { ProfileForm } from "@/components/ProfileForm";
import { PhotoManager } from "@/components/PhotoManager";
import { ShareLinkCreator } from "@/components/ShareLinkCreator";
import { DeleteProfileButton } from "@/components/DeleteProfileButton";
import { updateProfileAction } from "@/lib/actions/profiles";
import { uploadPhotosAction } from "@/lib/actions/photos";

export default async function ProfileDetailPage({
  params,
}: PageProps<"/admin/profiles/[id]">) {
  const { id } = await params;

  const [profile, allProfiles] = await Promise.all([
    getProfileWithPhotos(id),
    listProfiles({}),
  ]);

  if (!profile) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-maroon-700">
            {profile.full_name}
          </h1>
          <p className="text-sm text-ink-900/60">Edit profile details, photos and sharing.</p>
        </div>
        <DeleteProfileButton profileId={profile.id} />
      </div>

      <section className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-maroon-700">Details</h2>
        <ProfileForm
          profile={profile}
          action={updateProfileAction.bind(null, profile.id)}
          submitLabel="Save changes"
        />
      </section>

      <section className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-maroon-700">Photos</h2>
        <PhotoManager
          profileId={profile.id}
          photos={profile.photos}
          uploadAction={uploadPhotosAction.bind(null, profile.id)}
        />
      </section>

      <section className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-maroon-700">
          Share this profile
        </h2>
        <ShareLinkCreator
          allProfiles={allProfiles.map((p) => ({ id: p.id, full_name: p.full_name, city: p.city }))}
          preselectedIds={[profile.id]}
        />
      </section>
    </div>
  );
}
