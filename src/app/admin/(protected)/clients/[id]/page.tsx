import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Heart, Phone } from "lucide-react";
import { getClientById } from "@/lib/data/clients";
import { listShareLinksForClient } from "@/lib/data/share-links";
import { listShortlistedProfiles } from "@/lib/data/shortlists";
import { listClientSearches } from "@/lib/data/searches";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatRelativeDays } from "@/lib/format";

export default async function ClientDetailPage({ params }: PageProps<"/admin/clients/[id]">) {
  const { id } = await params;

  const client = await getClientById(id);
  if (!client) notFound();

  const [links, shortlisted, searches] = await Promise.all([
    listShareLinksForClient(id),
    listShortlistedProfiles(id),
    listClientSearches(id).catch(() => []),
  ]);

  // The same profile can appear in several links; show each one once.
  const sharedProfiles = new Map<string, { id: string; full_name: string; city: string | null }>();
  for (const link of links) {
    for (const p of link.profiles) sharedProfiles.set(p.id, p);
  }
  const shortlistedIds = new Set(shortlisted.map((s) => s.profile_id));

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/clients"
        className="inline-flex w-fit items-center gap-2 text-sm text-maroon-700 hover:underline"
      >
        <ArrowLeft size={15} /> Back to clients
      </Link>

      <div>
        <h1 className="font-serif text-3xl font-semibold text-maroon-700">{client.full_name}</h1>
        <p className="flex items-center gap-1.5 text-sm text-ink-900/60">
          <Phone size={14} />
          {client.phone_display ?? client.phone}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-maroon-700/60">Profiles shared</p>
          <p className="font-serif text-2xl text-maroon-700">{sharedProfiles.size}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-maroon-700/60">Shortlisted</p>
          <p className="font-serif text-2xl text-maroon-700">{shortlisted.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-maroon-700/60">Last activity</p>
          <p className="font-serif text-2xl text-maroon-700">
            {formatRelativeDays(client.last_activity_at)}
          </p>
        </Card>
      </div>

      <section className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
        <h2 className="mb-3 font-serif text-xl font-semibold text-maroon-700">
          Shortlisted profiles
        </h2>
        {shortlisted.length === 0 ? (
          <p className="text-sm text-ink-900/50">Nothing shortlisted yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {shortlisted.map((s) => (
              <Link
                key={s.profile_id}
                href={`/admin/profiles/${s.profile_id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blush-200 bg-white/60 px-3 py-2 text-sm hover:bg-blush-100"
              >
                <span className="flex items-center gap-2 font-medium text-maroon-700">
                  <Heart size={14} fill="currentColor" />
                  {s.full_name}
                  {s.city ? <span className="text-ink-900/50">· {s.city}</span> : null}
                </span>
                <span className="text-xs text-ink-900/50">{formatDate(s.created_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
        <h2 className="mb-3 font-serif text-xl font-semibold text-maroon-700">Profiles shared</h2>
        {sharedProfiles.size === 0 ? (
          <p className="text-sm text-ink-900/50">Nothing shared with this client yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Array.from(sharedProfiles.values()).map((p) => (
              <Link key={p.id} href={`/admin/profiles/${p.id}`}>
                <Badge tone={shortlistedIds.has(p.id) ? "maroon" : "neutral"}>
                  {shortlistedIds.has(p.id) && <Heart size={11} fill="currentColor" />}
                  {p.full_name}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
        <h2 className="mb-3 font-serif text-xl font-semibold text-maroon-700">
          What they searched for
        </h2>
        {searches.length === 0 ? (
          <p className="text-sm text-ink-900/50">No searches recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {searches.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blush-200 bg-white/60 px-3 py-2 text-sm"
              >
                <span className="flex flex-wrap gap-1.5">
                  {Object.entries(s.filters).map(([k, v]) => (
                    <Badge key={k} tone="neutral">
                      {k}: {v}
                    </Badge>
                  ))}
                </span>
                <span className="text-xs text-ink-900/50">
                  {s.result_count ?? 0} results · {formatDate(s.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
        <h2 className="mb-3 font-serif text-xl font-semibold text-maroon-700">Share links</h2>
        {links.length === 0 ? (
          <p className="text-sm text-ink-900/50">No links yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {links.map((link) => {
              const expired = new Date(link.expires_at) < new Date();
              return (
                <div
                  key={link.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blush-200 bg-white/60 px-3 py-2 text-sm"
                >
                  <span className="text-ink-900/70">
                    {link.label || `${link.profiles.length} profile${link.profiles.length === 1 ? "" : "s"}`}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-ink-900/50">
                    <span>Sent {formatDate(link.created_at)}</span>
                    <span>·</span>
                    <span>
                      {link.view_count > 0
                        ? `Opened ${link.view_count}× · ${formatRelativeDays(link.last_viewed_at)}`
                        : "Never opened"}
                    </span>
                    {link.revoked ? (
                      <Badge tone="danger">Revoked</Badge>
                    ) : expired ? (
                      <Badge tone="neutral">Expired</Badge>
                    ) : (
                      <Badge tone="olive">Active</Badge>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
