import { ProfilePhotoCarousel } from "@/components/ProfilePhotoCarousel";
import { ShortlistButton } from "@/components/ShortlistButton";
import { Badge } from "@/components/ui/Badge";
import { calculateAge, formatDate, formatHeight, formatInrCompact } from "@/lib/format";
import type { PublicProfile } from "@/lib/types";

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-maroon-700/60">
        {label}
      </dt>
      <dd className="text-sm text-ink-900">{value}</dd>
    </div>
  );
}

export function ClientProfileCard({
  profile,
  shortlist,
}: {
  profile: PublicProfile;
  shortlist?: { token: string; shortlisted: boolean; needsIdentity: boolean };
}) {
  const age = calculateAge(profile.dob);

  return (
    <article className="overflow-hidden rounded-3xl border border-gold-400/25 bg-white/70 shadow-lg backdrop-blur-sm">
      <div className="grid gap-0 md:grid-cols-[minmax(0,360px)_1fr]">
        <div className="p-4">
          <ProfilePhotoCarousel photos={profile.photos} alt={profile.full_name} />
        </div>

        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-maroon-700">
                {profile.full_name}
              </h2>
              <p className="text-sm text-ink-900/60">
                {age ? `${age} years` : null}
                {profile.city ? ` · ${profile.city}${profile.state ? `, ${profile.state}` : ""}` : ""}
              </p>
            </div>
            {shortlist && (
              <ShortlistButton
                token={shortlist.token}
                profileId={profile.id}
                initialShortlisted={shortlist.shortlisted}
                needsIdentity={shortlist.needsIdentity}
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {profile.religion && <Badge tone="gold">{profile.religion}</Badge>}
            {profile.caste && <Badge tone="gold">{profile.caste}</Badge>}
            {profile.height_cm && <Badge tone="neutral">{formatHeight(profile.height_cm)}</Badge>}
          </div>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Detail label="Date of Birth" value={profile.dob ? formatDate(profile.dob) : undefined} />
            <Detail label="Time of Birth" value={profile.birth_time} />
            <Detail label="Height" value={profile.height_cm ? formatHeight(profile.height_cm) : undefined} />
            <Detail label="Native" value={profile.native_place} />
            <Detail label="Mother Tongue" value={profile.mother_tongue} />
            <Detail label="Education" value={profile.education_degree} />
            <Detail label="Institution" value={profile.institution} />
            <Detail label="Profession" value={profile.profession} />
            <Detail label="Business" value={profile.business} />
            <Detail label="Company" value={profile.company} />
            <Detail
              label="Annual Income"
              value={profile.annual_income_inr ? formatInrCompact(profile.annual_income_inr) : undefined}
            />
            <Detail label="Father's Profession" value={profile.father_profession} />
            <Detail label="Mother's Profession" value={profile.mother_profession} />
            <Detail
              label="Siblings"
              value={profile.siblings_count !== undefined ? String(profile.siblings_count) : undefined}
            />
            <Detail label="Birth Place" value={profile.birth_place} />
            <Detail label="Star Sign" value={profile.star_sign} />
            <Detail label="Primary Contact" value={profile.primary_contact_name} />
            <Detail label="Relation" value={profile.primary_contact_relation} />
            <Detail label="Contact Phone" value={profile.contact_phone} />
            <Detail label="Contact Email" value={profile.contact_email} />
          </dl>

          {profile.hobbies && profile.hobbies.length > 0 && (
            <Detail label="Hobbies & Interests" value={profile.hobbies.join(", ")} />
          )}
          {profile.family_status_notes && (
            <Detail label="Family Background" value={profile.family_status_notes} />
          )}
          {profile.partner_expectations && (
            <Detail label="Partner Expectations" value={profile.partner_expectations} />
          )}
        </div>
      </div>
    </article>
  );
}
