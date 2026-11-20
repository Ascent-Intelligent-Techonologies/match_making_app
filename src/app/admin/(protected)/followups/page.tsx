import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listTeamNotes } from "@/lib/data/team-notes";
import { listClientMatches } from "@/lib/data/client-matches";
import { getCoverPhotoUrls } from "@/lib/data/photos";
import { TEAM_MEMBERS } from "@/lib/constants";
import { TeamNoteCard } from "@/components/TeamNoteCard";
import { ClientMatchTable } from "@/components/ClientMatchTable";
import { NewClientMatchForm } from "@/components/NewClientMatchForm";

export const metadata = { title: "Follow-up | AnuRupa Admin" };

const TABS = [
  { id: "admins", label: "Admins", href: "/admin/followups" },
  { id: "client-match", label: "Client match", href: "/admin/followups?tab=client-match" },
] as const;

/** The running bullet lists, one per consultant: what this page used to be on its own. */
async function AdminsTab() {
  const notes = await listTeamNotes();
  const bodyFor = (slug: string) => notes.find((n) => n.slug === slug)?.body ?? "";

  return (
    <>
      <p className="max-w-2xl text-sm text-ink-900/60">
        A running list for each of you. Press Enter to start the next bullet, then save.
      </p>
      <div className="grid gap-5 lg:grid-cols-3">
        {TEAM_MEMBERS.map(({ slug, name }) => (
          <TeamNoteCard key={slug} slug={slug} name={name} initialBody={bodyFor(slug)} />
        ))}
      </div>
    </>
  );
}

/** Boys and girls whose families are in communication with each other. */
async function ClientMatchTab() {
  const matches = await listClientMatches();
  const covers = await getCoverPhotoUrls(matches.flatMap((m) => [m.boy.id, m.girl.id]));

  return (
    <>
      <p className="max-w-2xl text-sm text-ink-900/60">
        Pairs of a boy&rsquo;s and a girl&rsquo;s profile that are in communication. Add a
        row when two families start talking, and delete it when it is over.
      </p>
      <NewClientMatchForm />
      <ClientMatchTable matches={matches} covers={covers} />
    </>
  );
}

export default async function FollowupsPage({ searchParams }: PageProps<"/admin/followups">) {
  const { tab: requested } = await searchParams;
  const active = (Array.isArray(requested) ? requested[0] : requested) === "client-match"
    ? "client-match"
    : "admins";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-maroon-700/70 hover:text-maroon-700"
        >
          <ArrowLeft size={15} /> Back
        </Link>
        <h1 className="font-serif text-3xl font-semibold text-maroon-700">Follow-up</h1>
      </div>

      <nav
        aria-label="Follow-up sections"
        className="flex w-fit flex-wrap gap-1 rounded-2xl bg-blush-100 p-1.5"
      >
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={tab.id === active ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab.id === active
                ? "bg-maroon-600 text-blush-50 shadow-sm"
                : "text-maroon-700/70 hover:bg-white/60"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {active === "admins" ? <AdminsTab /> : <ClientMatchTab />}
    </div>
  );
}
