import Link from "next/link";
import { Heart, MailX, Phone, PhoneCall, Send, Trash2, UserX, Users } from "lucide-react";
import {
  getClientAnalytics,
  RECENT_CONTACT_DAYS,
  STALE_CLIENT_DAYS,
} from "@/lib/data/clients";
import { listRecentFollowups } from "@/lib/data/followups";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DeleteChoiceButton } from "@/components/DeleteChoiceButton";
import {
  purgeClientAction,
  softDeleteClientInPlaceAction,
} from "@/lib/actions/clients";
import { listDeletedProfiles } from "@/lib/data/profiles";
import { listDeletedClients } from "@/lib/data/clients";
import { formatDate, formatRelativeDays } from "@/lib/format";
import type { ClientSummary } from "@/lib/types";

function ClientList({
  clients,
  emptyMessage,
  deletable = false,
}: {
  clients: ClientSummary[];
  emptyMessage: string;
  /** Adds a delete control to each row, for lists that are a clean-up queue. */
  deletable?: boolean;
}) {
  if (clients.length === 0) {
    return <p className="text-sm text-ink-900/50">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {clients.map((client) => {
        const detail = (
          <>
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
                {deletable
                  ? `Added ${formatDate(client.created_at)}`
                  : `Sent ${formatDate(client.lastSharedAt ?? client.created_at)} · Active ${formatRelativeDays(client.last_activity_at)}`}
              </span>
            </span>
          </>
        );

        // A button cannot live inside an anchor, so a deletable row puts the
        // link on the name alone rather than wrapping the whole row.
        if (!deletable) {
          return (
            <Link
              key={client.id}
              href={`/admin/clients/${client.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blush-200 bg-white/60 px-3 py-2.5 hover:bg-blush-100"
            >
              {detail}
            </Link>
          );
        }

        return (
          <div
            key={client.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blush-200 bg-white/60 px-3 py-2.5"
          >
            <Link
              href={`/admin/clients/${client.id}`}
              className="flex flex-1 flex-wrap items-center justify-between gap-2 hover:underline"
            >
              {detail}
            </Link>
            <DeleteChoiceButton
              what={client.full_name}
              softAction={softDeleteClientInPlaceAction.bind(null, client.id)}
              hardAction={purgeClientAction.bind(null, client.id)}
              hardDescription="Destroys their shortlists, follow-ups, searches and share links. Profiles are not affected."
            />
          </div>
        );
      })}
    </div>
  );
}

export default async function AnalyticsPage() {
  const [analytics, followups, deletedProfiles, deletedClients] = await Promise.all([
    getClientAnalytics(),
    listRecentFollowups().catch(() => []),
    listDeletedProfiles().catch(() => []),
    listDeletedClients().catch(() => []),
  ]);
  const deletedCount = deletedProfiles.length + deletedClients.length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-maroon-700">Analytics</h1>
        <p className="text-sm text-ink-900/60">
          Who you have reached out to, and who has gone quiet.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-maroon-700/60">
            <UserX size={12} /> Never contacted
          </p>
          <p className="font-serif text-2xl text-maroon-700">
            {analytics.neverContacted.length}
          </p>
        </Card>
        <Link href="/admin/deleted">
          <Card className="h-full p-4 transition-transform hover:-translate-y-0.5">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-maroon-700/60">
              <Trash2 size={12} /> Deleted
            </p>
            <p className="font-serif text-2xl text-maroon-700">{deletedCount}</p>
          </Card>
        </Link>
      </div>

      <section className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
        <h2 className="font-serif text-xl font-semibold text-maroon-700">Recent follow-ups</h2>
        <p className="mb-3 text-sm text-ink-900/50">
          The latest conversations logged against a client.
        </p>
        {followups.length === 0 ? (
          <p className="text-sm text-ink-900/50">
            No follow-ups logged yet. Open a client and log one when they call.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {followups.map((f) => (
              <Link
                key={f.id}
                href={`/admin/clients/${f.client_id}`}
                className="rounded-lg border border-blush-200 bg-white/60 px-3 py-2.5 hover:bg-blush-100"
              >
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-maroon-700">
                  <PhoneCall size={12} />
                  {f.client?.full_name ?? "Unknown client"}
                  <span className="text-xs font-normal text-ink-900/50">
                    {f.client?.phone_display ?? f.client?.phone}
                  </span>
                  <span className="text-xs font-normal text-ink-900/40">
                    · {formatRelativeDays(f.created_at)}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-900/80">{f.note}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

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

      <section className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
        <h2 className="font-serif text-xl font-semibold text-maroon-700">
          Never contacted at all
        </h2>
        <p className="mb-3 text-sm text-ink-900/50">
          We took their details but have never sent them a single profile. Oldest first
          — these are the ones most likely to have been forgotten.
        </p>
        <ClientList
          clients={analytics.neverContacted}
          emptyMessage="Everyone on the books has been sent something."
          deletable
        />
      </section>
    </div>
  );
}
