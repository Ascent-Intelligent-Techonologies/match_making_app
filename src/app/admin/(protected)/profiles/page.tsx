import Link from "next/link";
import { Plus } from "lucide-react";
import { listProfiles, listProfileBirthYears } from "@/lib/data/profiles";
import { getCoverPhotoUrls } from "@/lib/data/photos";
import { getAppSettings } from "@/lib/data/settings";
import { listClientsForPicker } from "@/lib/data/clients";
import { ProfilesFilterBar } from "@/components/ProfilesFilterBar";
import { ProfileSelectionGrid } from "@/components/ProfileSelectionGrid";
import { Button } from "@/components/ui/Button";

export default async function AdminDashboardPage({
  searchParams,
}: PageProps<"/admin/profiles">) {
  const params = await searchParams;
  const getStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const gender = getStr(params.gender);
  const [profiles, settings, clients, birthYears] = await Promise.all([
    listProfiles({
      search: getStr(params.search),
      gender,
      religion: getStr(params.religion),
      caste: getStr(params.caste),
      tags: getStr(params.tags)?.split(",").filter(Boolean),
      anurupaAura: getStr(params.anurupaAura) === "1",
      minAge: params.minAge ? Number(getStr(params.minAge)) : undefined,
      maxAge: params.maxAge ? Number(getStr(params.maxAge)) : undefined,
      minHeight: params.minHeight ? Number(getStr(params.minHeight)) : undefined,
      maxHeight: params.maxHeight ? Number(getStr(params.maxHeight)) : undefined,
      minFinances: params.minFinances ? Number(getStr(params.minFinances)) : undefined,
      maxFinances: params.maxFinances ? Number(getStr(params.maxFinances)) : undefined,
      birthYear: params.birthYear ? Number(getStr(params.birthYear)) : undefined,
      professionCategory: getStr(params.professionCategory),
      urgent: getStr(params.urgent) === "1",
      potentialClient: getStr(params.potentialClient) === "1",
    }),
    getAppSettings(),
    listClientsForPicker(),
    listProfileBirthYears(gender),
  ]);

  const coverUrls = await getCoverPhotoUrls(profiles.map((p) => p.id));

  const selectableProfiles = profiles.map((p) => ({
    id: p.id,
    urgent: p.urgent,
    anurupa_aura: p.anurupa_aura,
    full_name: p.full_name,
    city: p.city,
    dob: p.dob,
    is_active: p.is_active,
    profession: p.profession,
    religion: p.religion,
    caste: p.caste,
    height_cm: p.height_cm,
    annual_income_inr: p.annual_income_inr,
    coverUrl: coverUrls.get(p.id),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-maroon-700">All Profiles</h1>
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

      <ProfilesFilterBar birthYears={birthYears} />

      <ProfileSelectionGrid
        profiles={selectableProfiles}
        defaultExpiryDays={settings.default_expiry_days}
        existingClients={clients}
      />
    </div>
  );
}
