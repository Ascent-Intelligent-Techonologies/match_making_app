import Link from "next/link";
import { Heart, MailX, Phone, Send, Users } from "lucide-react";
import {
  getClientAnalytics,
  RECENT_CONTACT_DAYS,
  STALE_CLIENT_DAYS,
} from "@/lib/data/clients";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatRelativeDays } from "@/lib/format";
import type { ClientSummary } from "@/lib/types";

function ClientList({
  clients,
  emptyMessage,
}: {
  clients: ClientSummary[];
  emptyMessage: string;
}) {
  if (clients.length === 0) {
    return <p className="text-sm text-ink-900/50">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {clients.map((client) => (
        <Link
          key={client.id}
          href={`/admin/clients/${client.id}`}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blush-200 bg-white/60 px-3 py-2.5 hover:bg-blush-100"
        >
          <span className="flex flex-col">
            <span className="text-sm font-medium text-maroon-700">{client.full_name}</span>
            <span className="flex items-center gap-1.5 text-xs text-ink-900/50">
              <Phone size={11} />
              {client.phone_display ?? client.phone}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone="olive">
              <Send size={11} /> {client.sharedProfileCount}
            </Badge>
            <Badge tone={client.shortlistedCount > 0 ? "maroon" : "neutral"}>
              <Heart size={11} /> {client.shortlistedCount}
            </Badge>
            <span className="text-xs text-ink-900/50">
              Sent {formatDate(client.lastSharedAt ?? client.created_at)} · Active{" "}
              {formatRelativeDays(client.last_activity_at)}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

export default async function AnalyticsPage() {
  const analytics = await getClientAnalytics();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-maroon-700">Analytics</h1>
        <p className="text-sm text-ink-900/60">
          Who you have reached out to, and who has gone quiet.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-maroon-700/60">
            <Users size={12} /> Clients
          </p>
          <p className="font-serif text-2xl text-maroon-700">{analytics.totalClients}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-maroon-700/60">
            <Send size={12} /> Contacted this week
          </p>
          <p className="font-serif text-2xl text-maroon-700">
            {analytics.recentlyContacted.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-maroon-700/60">
            <MailX size={12} /> Gone quiet
          </p>
          <p className="font-serif text-2xl text-maroon-700">{analytics.goneQuiet.length}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-maroon-700/60">
            <Heart size={12} /> Shortlists
          </p>
          <p className="font-serif text-2xl text-maroon-700">{analytics.totalShortlists}</p>
        </Card>
      </div>

      <section className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
        <h2 className="font-serif text-xl font-semibold text-maroon-700">
          Contacted in the last {RECENT_CONTACT_DAYS} days
        </h2>
        <p className="mb-3 text-sm text-ink-900/50">
          Clients you shared profiles with recently.
        </p>
        <ClientList
          clients={analytics.recentlyContacted}
          emptyMessage={`No one has been contacted in the last ${RECENT_CONTACT_DAYS} days.`}
        />
      </section>

      <section className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
        <h2 className="font-serif text-xl font-semibold text-maroon-700">
          No response in {STALE_CLIENT_DAYS}+ days
        </h2>
        <p className="mb-3 text-sm text-ink-900/50">
          Contacted over {STALE_CLIENT_DAYS} days ago and have not opened a link or shortlisted
          anyone since. Worth a follow-up.
        </p>
        <ClientList
          clients={analytics.goneQuiet}
          emptyMessage="Everyone has engaged recently."
        />
      </section>

      <section className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
        <h2 className="font-serif text-xl font-semibold text-maroon-700">Never opened a link</h2>
        <p className="mb-3 text-sm text-ink-900/50">
          We have shared profiles with them, but they have never opened the link.
        </p>
        <ClientList
          clients={analytics.neverOpened}
          emptyMessage="Every client has opened at least one link."
        />
      </section>
    </div>
  );
}
