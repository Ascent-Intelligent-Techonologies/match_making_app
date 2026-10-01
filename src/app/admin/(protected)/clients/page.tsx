import Link from "next/link";
import { Heart, Phone, Send } from "lucide-react";
import { listClientSummaries } from "@/lib/data/clients";
import { ClientSearchBar } from "@/components/ClientSearchBar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatRelativeDays } from "@/lib/format";

export default async function ClientsPage({ searchParams }: PageProps<"/admin/clients">) {
  const params = await searchParams;
  const search = Array.isArray(params.search) ? params.search[0] : params.search;
  const clients = await listClientSummaries(search);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-maroon-700">Clients</h1>
        <p className="text-sm text-ink-900/60">
          {clients.length} client{clients.length === 1 ? "" : "s"}
          {search ? ` matching “${search}”` : ""}
        </p>
      </div>

      <ClientSearchBar />

      {clients.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gold-400/40 bg-white/40 p-10 text-center text-sm text-ink-900/50">
          {search
            ? "No clients match that search."
            : "No clients yet — they are created automatically when you share profiles."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {clients.map((client) => (
            <Link key={client.id} href={`/admin/clients/${client.id}`}>
              <Card className="p-4 transition-transform hover:-translate-y-0.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-lg font-semibold text-maroon-700">
                      {client.full_name}
                    </h2>
                    <p className="flex items-center gap-1.5 text-sm text-ink-900/60">
                      <Phone size={13} />
                      {client.phone_display ?? client.phone}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="olive">
                      <Send size={11} /> {client.sharedProfileCount} shared
                    </Badge>
                    <Badge tone={client.shortlistedCount > 0 ? "maroon" : "neutral"}>
                      <Heart size={11} /> {client.shortlistedCount} shortlisted
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-900/50">
                  <span>Last shared: {formatDate(client.lastSharedAt)}</span>
                  <span>Last activity: {formatRelativeDays(client.last_activity_at)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
