import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { listProfiles } from "@/lib/data/profiles";
import { getCoverPhotoUrls } from "@/lib/data/photos";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { calculateAge, formatInrCompact, titleCase } from "@/lib/format";

export default async function AdminDashboardPage({
  searchParams,
}: PageProps<"/admin">) {
  const params = await searchParams;
  const getStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const profiles = await listProfiles({
    search: getStr(params.search),
    gender: getStr(params.gender),
    religion: getStr(params.religion),
    maritalStatus: getStr(params.maritalStatus),
    diet: getStr(params.diet),
    manglik: getStr(params.manglik),
    minAge: params.minAge ? Number(getStr(params.minAge)) : undefined,
    maxAge: params.maxAge ? Number(getStr(params.maxAge)) : undefined,
  });

  const coverUrls = await getCoverPhotoUrls(profiles.map((p) => p.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-maroon-700">Profiles</h1>
          <p className="text-sm text-ink-900/60">
            {profiles.length} profile{profiles.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/admin/profiles/new">
          <Button>
            <Plus size={16} /> New Profile
          </Button>
        </Link>
      </div>

      <SearchFilterBar />

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
              <Link key={profile.id} href={`/admin/profiles/${profile.id}`}>
                <Card className="overflow-hidden transition-transform hover:-translate-y-0.5">
                  <div className="relative aspect-[4/3] bg-blush-100">
                    {coverUrl && (
                      <Image src={coverUrl} alt={profile.full_name} fill className="object-cover" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-serif text-lg font-semibold text-maroon-700">
                        {profile.full_name}
                      </h2>
                      {!profile.is_active && <Badge tone="neutral">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-ink-900/60">
                      {age ? `${age} yrs` : "Age —"} · {profile.city ?? "City —"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.profession && <Badge tone="olive">{profile.profession}</Badge>}
                      {profile.religion && <Badge tone="gold">{profile.religion}</Badge>}
                      {profile.annual_income_inr && (
                        <Badge tone="maroon">{formatInrCompact(profile.annual_income_inr)}</Badge>
                      )}
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
    </div>
  );
}
