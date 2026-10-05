import Link from "next/link";
import { Phone, Users } from "lucide-react";
import { listProfiles } from "@/lib/data/profiles";
import { feetInchesToCm } from "@/lib/format";
import { getCoverPhotoUrls } from "@/lib/data/photos";
import { getAppSettings } from "@/lib/data/settings";
import {
  getClientById,
  getSharedProfileIdsForClient,
  listClientsForPicker,
} from "@/lib/data/clients";
import { getShortlistedProfileIds } from "@/lib/data/shortlists";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import { SearchResultsGrid } from "@/components/SearchResultsGrid";
import { ClientChooser } from "@/components/ClientChooser";

export default async function SearchPage({ searchParams }: PageProps<"/admin/search">) {
  const params = await searchParams;
  const getStr = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const num = (v: string | string[] | undefined) =>
    getStr(v) ? Number(getStr(v)) : undefined;

  const clientId = getStr(params.client);
  const client = clientId ? await getClientById(clientId) : null;

  if (!client) {
    const clients = await listClientsForPicker();
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-maroon-700">Search</h1>
          <p className="text-sm text-ink-900/60">
            Searches are tracked per client, so we know who has seen what.
          </p>
        </div>
        <ClientChooser existingClients={clients} />
      </div>
    );
  }

  const [profiles, settings, sharedIds, shortlistedIds] = await Promise.all([
    listProfiles({
      search: getStr(params.search),
      gender: getStr(params.gender),
      caste: getStr(params.caste),
      tags: getStr(params.tags)?.split(",").filter(Boolean),
      anurupaAura: getStr(params.anurupaAura) === "1",
      minAge: num(params.minAge),
      maxAge: num(params.maxAge),
      minHeight: feetInchesToCm(num(params.minHeightFt), num(params.minHeightIn)),
      maxHeight: feetInchesToCm(num(params.maxHeightFt), num(params.maxHeightIn)),
      minFinances: num(params.minFinances),
      maxFinances: num(params.maxFinances),
      professionCategory: getStr(params.professionCategory),
      urgent: getStr(params.urgent) === "1",
      potentialClient: getStr(params.potentialClient) === "1",
    }),
    getAppSettings(),
    getSharedProfileIdsForClient(client.id),
    getShortlistedProfileIds(client.id),
  ]);

  const coverUrls = await getCoverPhotoUrls(profiles.map((p) => p.id));
  const shared = new Set(sharedIds);
  const shortlisted = new Set(shortlistedIds);

  const results = profiles.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    surname: p.surname,
    dob: p.dob,
    height_cm: p.height_cm,
    caste: p.caste,
    sub_caste: p.sub_caste,
    requirements: p.partner_expectations,
    urgent: p.urgent,
    anurupa_aura: p.anurupa_aura,
    coverUrl: coverUrls.get(p.id),
    alreadyShared: shared.has(p.id),
    shortlisted: shortlisted.has(p.id),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-maroon-700">Search</h1>
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-ink-900/60">
            <span className="flex items-center gap-1.5">
              <Users size={14} /> Searching for{" "}
              <Link href={`/admin/clients/${client.id}`} className="font-medium text-maroon-700 hover:underline">
                {client.full_name}
              </Link>
            </span>
            <span className="flex items-center gap-1.5">
              <Phone size={13} />
              {client.phone_display ?? client.phone}
            </span>
          </p>
        </div>
        <Link
          href="/admin/search"
          className="rounded-full border border-gold-400 px-4 py-2 text-sm font-medium text-maroon-700 hover:bg-blush-100"
        >
          Change client
        </Link>
      </div>

      <SearchFilterBar />

      <SearchResultsGrid
        results={results}
        client={{
          id: client.id,
          full_name: client.full_name,
          phone: client.phone_display ?? client.phone,
        }}
        defaultExpiryDays={settings.default_expiry_days}
      />
    </div>
  );
}
