import Link from "next/link";
import Image from "next/image";
import { listProfiles } from "@/lib/data/profiles";
import { getCoverPhotoUrls } from "@/lib/data/photos";
import { PublicSearchFilterBar } from "@/components/PublicSearchFilterBar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { calculateAge, titleCase } from "@/lib/format";

export default async function BrowseProfilesPage({
  searchParams,
}: PageProps<"/browse">) {
  const params = await searchParams;
  const getStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  // Deliberately whitelisted: income/manglik filters are never exposed on the public route.
  const profiles = await listProfiles({
    search: getStr(params.search),
    gender: getStr(params.gender),
    religion: getStr(params.religion),
    maritalStatus: getStr(params.maritalStatus),
    diet: getStr(params.diet),
    minAge: params.minAge ? Number(getStr(params.minAge)) : undefined,
    maxAge: params.maxAge ? Number(getStr(params.maxAge)) : undefined,
  });

  const coverUrls = await getCoverPhotoUrls(profiles.map((p) => p.id));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col items-center gap-1 text-center">
        <p className="font-serif text-3xl font-semibold text-olive-500">AURA</p>
        <p className="font-script text-lg italic text-maroon-700">Where destiny aligns</p>
        <p className="mt-2 max-w-lg text-sm text-ink-900/60">
          Browse a curated selection of profiles. Reach out to your Aura consultant for a
          personal introduction and full details.
        </p>
      </header>

      <PublicSearchFilterBar />

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
              <Link key={profile.id} href={`/browse/${profile.id}`}>
                <Card className="overflow-hidden transition-transform hover:-translate-y-0.5">
                  <div className="relative aspect-[4/5] bg-blush-100">
                    {coverUrl && (
                      <Image src={coverUrl} alt={profile.full_name} fill className="object-cover" />
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
                      {profile.religion && <Badge tone="gold">{profile.religion}</Badge>}
                      {profile.marital_status && (
                        <Badge tone="neutral">{titleCase(profile.marital_status)}</Badge>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
