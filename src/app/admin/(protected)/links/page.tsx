import { listShareLinks } from "@/lib/data/share-links";
import { listProfiles } from "@/lib/data/profiles";
import { listClientsForPicker } from "@/lib/data/clients";
import { ShareLinkCreator } from "@/components/ShareLinkCreator";
import { ShareLinkRow } from "@/components/ShareLinkRow";

export default async function ShareLinksPage() {
  const [links, profiles, clients] = await Promise.all([
    listShareLinks(),
    listProfiles({}),
    listClientsForPicker(),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-maroon-700">Share Links</h1>
        <p className="text-sm text-ink-900/60">
          Create, monitor and revoke the links shared with prospective families. A link
          stays live until you revoke or delete it.
        </p>
      </div>

      <section className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-maroon-700">New share link</h2>
        <ShareLinkCreator
          allProfiles={profiles.map((p) => ({ id: p.id, full_name: p.full_name, city: p.city }))}
          existingClients={clients}
        />
      </section>

      <section className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
        <h2 className="mb-4 font-serif text-xl font-semibold text-maroon-700">All links</h2>
        {links.length === 0 ? (
          <p className="text-sm text-ink-900/50">No share links created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-blush-200 text-xs uppercase tracking-wider text-maroon-700/60">
                  <th className="pb-2 pr-4 font-medium">Profiles &amp; note</th>
                  <th className="pb-2 pr-4 font-medium">Access</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Created</th>
                  <th className="pb-2 pr-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <ShareLinkRow key={link.id} link={link} siteUrl={siteUrl} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
