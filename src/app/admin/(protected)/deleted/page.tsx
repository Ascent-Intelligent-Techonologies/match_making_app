import Link from "next/link";
import { ArrowLeft, Phone, RotateCcw, Undo2 } from "lucide-react";
import { listDeletedProfiles } from "@/lib/data/profiles";
import { listDeletedClients } from "@/lib/data/clients";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { purgeProfileAction, restoreProfileAction } from "@/lib/actions/profiles";
import { purgeClientAction, restoreClientAction } from "@/lib/actions/clients";
import { calculateAge, formatDate, formatRelativeDays } from "@/lib/format";

export const metadata = { title: "Deleted | AnuRupa Admin" };

/**
 * Restore is a plain form button rather than a client component: it has no
 * confirmation step and nothing to lose, so a form post is all it needs.
 */
function RestoreButton({ action, label }: { action: () => Promise<void>; label: string }) {
  return (
    <form action={action}>
      <Button type="submit" size="sm" variant="secondary">
        <Undo2 size={13} /> {label}
      </Button>
    </form>
  );
}

export default async function DeletedPage() {
  const [profiles, clients] = await Promise.all([
    listDeletedProfiles(),
    listDeletedClients(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-maroon-700/70 hover:text-maroon-700"
        >
          <ArrowLeft size={15} /> Back
        </Link>
        <h1 className="font-serif text-3xl font-semibold text-maroon-700">Deleted</h1>
        <p className="max-w-2xl text-sm text-ink-900/60">
          Records moved here are hidden from every other screen but nothing has been
          destroyed. Restore one to put it back exactly as it was, or delete it
          permanently to remove it for good.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-maroon-700/60">Profiles</p>
          <p className="font-serif text-2xl text-maroon-700">{profiles.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wider text-maroon-700/60">Clients</p>
          <p className="font-serif text-2xl text-maroon-700">{clients.length}</p>
        </Card>
      </div>

      <section className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
        <h2 className="mb-3 font-serif text-xl font-semibold text-maroon-700">
          Deleted profiles
        </h2>
        {profiles.length === 0 ? (
          <p className="text-sm text-ink-900/50">No deleted profiles.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {profiles.map((p) => {
              const age = calculateAge(p.dob);
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blush-200 bg-white/60 px-3 py-2.5"
                >
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-maroon-700">
                      {p.full_name}
                      {p.surname ? ` ${p.surname}` : ""}
                    </span>
                    <span className="text-xs text-ink-900/50">
                      {age ? `${age} yrs · ` : ""}
                      {p.city ?? "City —"} · deleted {formatRelativeDays(p.deleted_at)}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <RestoreButton
                      action={restoreProfileAction.bind(null, p.id)}
                      label="Restore"
                    />
                    <ConfirmDeleteButton
                      action={purgeProfileAction.bind(null, p.id)}
                      label="Delete permanently"
                      confirmLabel="Delete for good"
                      description="Removes the profile, its photos, and it from every share link and shortlist. This cannot be undone."
                    />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gold-400/25 bg-white/60 p-6">
        <h2 className="mb-3 font-serif text-xl font-semibold text-maroon-700">
          Deleted clients
        </h2>
        {clients.length === 0 ? (
          <p className="text-sm text-ink-900/50">No deleted clients.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {clients.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blush-200 bg-white/60 px-3 py-2.5"
              >
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-maroon-700">{c.full_name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-ink-900/50">
                    <Phone size={11} />
                    {c.phone_display ?? c.phone} · added {formatDate(c.created_at)} · deleted{" "}
                    {formatRelativeDays(c.deleted_at ?? null)}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <RestoreButton
                    action={restoreClientAction.bind(null, c.id)}
                    label="Restore"
                  />
                  <ConfirmDeleteButton
                    action={purgeClientAction.bind(null, c.id)}
                    label="Delete permanently"
                    confirmLabel="Delete for good"
                    description="Destroys their shortlists, follow-ups, searches and share links. This cannot be undone."
                  />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {(profiles.length > 0 || clients.length > 0) && (
        <p className="flex items-center gap-1.5 text-xs text-ink-900/50">
          <RotateCcw size={12} /> Restoring a client brings back their shortlists and
          follow-ups too — nothing was removed when they were deleted.
        </p>
      )}
    </div>
  );
}
