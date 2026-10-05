import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listTeamNotes } from "@/lib/data/team-notes";
import { TEAM_MEMBERS } from "@/lib/constants";
import { TeamNoteCard } from "@/components/TeamNoteCard";

export const metadata = { title: "Follow-up | AnuRupa Admin" };

export default async function FollowupsPage() {
  const notes = await listTeamNotes();
  const bodyFor = (slug: string) => notes.find((n) => n.slug === slug)?.body ?? "";

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
        <p className="max-w-2xl text-sm text-ink-900/60">
          A running list for each of you. Press Enter to start the next bullet, then
          save.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {TEAM_MEMBERS.map(({ slug, name }) => (
          <TeamNoteCard key={slug} slug={slug} name={name} initialBody={bodyFor(slug)} />
        ))}
      </div>
    </div>
  );
}
