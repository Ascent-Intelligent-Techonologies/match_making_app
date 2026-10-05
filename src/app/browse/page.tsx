import Link from "next/link";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { listProfiles } from "@/lib/data/profiles";
import { feetInchesToCm } from "@/lib/format";
import { getCoverPhotoUrls } from "@/lib/data/photos";
import { getShortlistedProfileIds } from "@/lib/data/shortlists";
import { getBrowsingClientId } from "@/lib/auth/client-session";
import { PublicSearchFilterBar } from "@/components/PublicSearchFilterBar";
import { BrowseGate } from "@/components/BrowseGate";
import { BrowseSearchTracker } from "@/components/BrowseSearchTracker";
import { BrowseShortlistButton } from "@/components/BrowseShortlistButton";
import { SlideshowButton } from "@/components/ProfileSlideshow";
import { toggleBrowseShortlistAction } from "@/lib/actions/browse";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { calculateAge, formatHeight } from "@/lib/format";

export default async function BrowseProfilesPage({
  searchParams,
}: PageProps<"/browse">) {
  // Nobody browses anonymously: we capture name + number first so filters and
  // likes are attributed to a client.
  const clientId = await getBrowsingClientId();
  if (!clientId) return <BrowseGate />;

  const params = await searchParams;
  const getStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  // Mirrors the search tab of the intake spreadsheet. The internal tag is
  // deliberately not accepted here — it stays admin-only.
  const num = (v: string | string[] | undefined) => (getStr(v) ? Number(getStr(v)) : undefined);
  const filters = {
    search: getStr(params.search),
    gender: getStr(params.gender),
    caste: getStr(params.caste),
    minAge: num(params.minAge),
    maxAge: num(params.maxAge),
    minHeight: feetInchesToCm(num(params.minHeightFt), num(params.minHeightIn)),
    maxHeight: feetInchesToCm(num(params.maxHeightFt), num(params.maxHeightIn)),
    minFinances: num(params.minFinances),
    maxFinances: num(params.maxFinances),
  };

  const profiles = await listProfiles(filters);
  const [coverUrls, shortlistedIds] = await Promise.all([
    getCoverPhotoUrls(profiles.map((p) => p.id)),
    getShortlistedProfileIds(clientId),
  ]);
  const shortlisted = new Set(shortlistedIds);

  const appliedFilters = Object.fromEntries(
    Object.entries(filters)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)])
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <BrowseSearchTracker filters={appliedFilters} resultCount={profiles.length} />

      {/* The logo reads as a watermark behind the page rather than a small
          mark competing with the filters. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 opacity-[0.12]">
        <Image
          src="/logo-anurupa.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>

      <header className="flex flex-col items-center gap-1 text-center">
        <p className="max-w-lg text-sm text-ink-900/70">
          Browse a curated selection of profiles and tap the heart on anyone you like.
          Your consultant will follow up with full details.
        </p>
      </header>

      <PublicSearchFilterBar />

      {profiles.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-900/60">
            {profiles.length} profile{profiles.length === 1 ? "" : "s"}
          </p>
          {/* The heart here is the same shortlist as the one on each card, so
              a profile can be taken forward without leaving the slideshow. */}
          <SlideshowButton
            onToggleFavorite={toggleBrowseShortlistAction}
            profiles={profiles.map((p) => ({
              id: p.id,
              full_name: p.full_name,
              subtitle: [
                calculateAge(p.dob) ? `${calculateAge(p.dob)} yrs` : null,
                p.city,
              ]
                .filter(Boolean)
                .join(" · "),
              badges: [
                p.caste,
                p.religion,
                p.height_cm ? formatHeight(p.height_cm) : null,
              ].filter((v): v is string => Boolean(v)),
              details: [
                p.profession ? { label: "Job", value: p.profession } : null,
                p.education_degree
                  ? { label: "Education", value: p.education_degree }
                  : null,
                p.native_place
                  ? { label: "Native place", value: p.native_place }
                  : null,
                p.mother_tongue
                  ? { label: "Mother tongue", value: p.mother_tongue }
                  : null,
              ].filter((d): d is { label: string; value: string } => d !== null),
              note: p.partner_expectations
                ? { label: "Looking for", value: p.partner_expectations }
                : undefined,
              coverUrl: coverUrls.get(p.id),
              href: `/browse/${p.id}`,
              favorite: shortlisted.has(p.id),
            }))}
          />
        </div>
      )}

      {profiles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gold-400/40 bg-white/40 p-10 text-center text-sm text-ink-900/50">
          No profiles match these filters yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => {
            const age = calculateAge(profile.dob);
            const coverUrl = coverUrls.get(profile.id);
            return (
              <div key={profile.id} className="relative">
                <BrowseShortlistButton
                  profileId={profile.id}
                  initialShortlisted={shortlisted.has(profile.id)}
                />
                <Link href={`/browse/${profile.id}`}>
                  <Card className="overflow-hidden transition-transform hover:-translate-y-0.5">
                    <div className="relative flex aspect-[4/5] items-center justify-center bg-blush-100">
                      {coverUrl ? (
                        <Image
                          src={coverUrl}
                          alt={profile.full_name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover"
                        />
                      ) : (
                        <ImageOff size={32} strokeWidth={1.25} className="text-maroon-700/40" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2 p-4">
                      <h2 className="font-serif text-lg font-semibold text-maroon-700">
                        {profile.full_name}
                      </h2>
                      <p className="text-sm text-ink-900/60">
                        {age ? `${age} yrs` : "Age —"} · {profile.city ?? "City —"}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.profession && <Badge tone="olive">{profile.profession}</Badge>}
                        {profile.caste && <Badge tone="gold">{profile.caste}</Badge>}
                        {profile.height_cm && (
                          <Badge tone="neutral">{formatHeight(profile.height_cm)}</Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
