import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { findLiveProfilesWithPhone, getProfileWithPhotos, listProfiles } from "@/lib/data/profiles";
import { ProfileForm } from "@/components/ProfileForm";
import { PhotoManager } from "@/components/PhotoManager";
import { ShareLinkCreator } from "@/components/ShareLinkCreator";
import { DeleteProfileButton } from "@/components/DeleteProfileButton";
import { ApprovalButtons } from "@/components/ApprovalButtons";
import { approveProfileAction, rejectProfileAction } from "@/lib/actions/approvals";
import { updateProfileAction } from "@/lib/actions/profiles";
import { formatRelativeDays } from "@/lib/format";
import type { ProfileWithPhotos } from "@/lib/types";

/**
 * What an admin sees above a profile that is not live yet. A self-onboarded
 * profile stays out of Search, All Profiles and the client list until it is
 * approved here, and can be corrected first: the form below is the full one,
 * internal fields included.
 */
async function ReviewBanner({ profile }: { profile: ProfileWithPhotos }) {
  if (profile.approval_status === "approved") return null;

  if (profile.approval_status === "draft") {
    return (
      <div className="rounded-xl border border-gold-400/40 bg-gold-400/10 p-4 text-sm text-ink-900/80">
        <p className="font-semibold text-maroon-700">Sign-up not finished</p>
        <p className="mt-1">
          This person started the sign-up form but has not submitted it (a photo may
          still be uploading). It is not in the approval queue, and is removed
          automatically if they never finish.
        </p>
      </div>
    );
  }

  const declined = profile.approval_status === "rejected";
  const sameNumber = declined ? [] : await findLiveProfilesWithPhone(profile.contact_phone, profile.id);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gold-400/40 bg-gold-400/10 p-4">
      <div>
        <p className="font-semibold text-maroon-700">
          {declined ? "Declined" : "Waiting for your approval"}
        </p>
        <p className="mt-1 text-sm text-ink-900/80">
          {declined
            ? `Declined ${formatRelativeDays(profile.reviewed_at)}. `
            : `Submitted ${formatRelativeDays(profile.submitted_at)} through the public form. `}
          Until you approve it, this profile is not in Search or All Profiles, is not
          a client, and cannot be shared. You can correct or add to anything below first.
        </p>
      </div>

      {sameNumber.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-red-700">
          <TriangleAlert size={14} />
          This number is already on {sameNumber.length === 1 ? "a profile" : "profiles"}:
          {sameNumber.map((m) => (
            <Link key={m.id} href={`/admin/profiles/${m.id}`} className="font-medium underline">
              {[m.full_name, m.surname].filter(Boolean).join(" ")}
            </Link>
          ))}
        </p>
      )}

      <ApprovalButtons
        approve={approveProfileAction.bind(null, profile.id)}
        reject={declined ? undefined : rejectProfileAction.bind(null, profile.id)}
        approveLabel={declined ? "Approve instead" : "Approve and add to profiles"}
      />
    </div>
  );
}

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

      <ReviewBanner profile={profile} />

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
        />
      </section>

      {/* A profile still under review cannot be shown to anyone. */}
      {profile.approval_status === "approved" && (
        <section className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
          <h2 className="mb-4 font-serif text-xl font-semibold text-maroon-700">
            Share this profile
          </h2>
          <ShareLinkCreator
            allProfiles={allProfiles.map((p) => ({ id: p.id, full_name: p.full_name, city: p.city }))}
            preselectedIds={[profile.id]}
          />
        </section>
      )}
    </div>
  );
}
