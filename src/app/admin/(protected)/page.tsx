import Link from "next/link";
import { Plus } from "lucide-react";
import { listProfiles } from "@/lib/data/profiles";
import { getCoverPhotoUrls } from "@/lib/data/photos";
import { getAppSettings } from "@/lib/data/settings";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { ProfileSelectionGrid } from "@/components/ProfileSelectionGrid";
import { Button } from "@/components/ui/Button";

export default async function AdminDashboardPage({
  searchParams,
}: PageProps<"/admin">) {
  const params = await searchParams;
  const getStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const [profiles, settings] = await Promise.all([
    listProfiles({
      search: getStr(params.search),
      gender: getStr(params.gender),
      religion: getStr(params.religion),
      maritalStatus: getStr(params.maritalStatus),
      diet: getStr(params.diet),
      manglik: getStr(params.manglik),
      minAge: params.minAge ? Number(getStr(params.minAge)) : undefined,
      maxAge: params.maxAge ? Number(getStr(params.maxAge)) : undefined,
    }),
    getAppSettings(),
  ]);

  const coverUrls = await getCoverPhotoUrls(profiles.map((p) => p.id));

  const selectableProfiles = profiles.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    city: p.city,
    dob: p.dob,
    is_active: p.is_active,
    profession: p.profession,
    religion: p.religion,
    annual_income_inr: p.annual_income_inr,
    marital_status: p.marital_status,
    coverUrl: coverUrls.get(p.id),
  }));

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

      <ProfileSelectionGrid
        profiles={selectableProfiles}
        defaultExpiryDays={settings.default_expiry_days}
      />
    </div>
  );
}
