import Link from "next/link";
import { BarChart3, LayoutGrid, Search, UserPlus, Users, Link2, Palette } from "lucide-react";
import { Card } from "@/components/ui/Card";

const SECTIONS = [
  {
    href: "/admin/profiles/new",
    title: "New Profile",
    description: "Add a profile using the full intake form.",
    Icon: UserPlus,
    accent: "bg-maroon-600",
  },
  {
    href: "/admin/search",
    title: "Search",
    description: "Search profiles for a client and share a shortlist with them.",
    Icon: Search,
    accent: "bg-blue-600",
  },
  {
    href: "/admin/profiles",
    title: "All Profiles",
    description: "Browse, filter and edit every profile on the books.",
    Icon: LayoutGrid,
    accent: "bg-olive-500",
  },
  {
    href: "/admin/analytics",
    title: "Dashboard",
    description: "Who was contacted recently, and who has gone quiet.",
    Icon: BarChart3,
    accent: "bg-orange-500",
  },
];

const SECONDARY = [
  { href: "/admin/clients", title: "Clients", Icon: Users },
  { href: "/admin/links", title: "Share Links", Icon: Link2 },
  { href: "/admin/settings", title: "Settings", Icon: Palette },
];

export default function AdminHomePage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-maroon-700">AnuRupa Matrimony</h1>
        <p className="text-sm text-ink-900/60">Where would you like to start?</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {SECTIONS.map(({ href, title, description, Icon, accent }) => (
          <Link key={href} href={href}>
            <Card className="flex h-full flex-col gap-3 p-6 transition-transform hover:-translate-y-0.5">
              <span className={`flex h-12 w-12 items-center justify-center rounded-full text-white ${accent}`}>
                <Icon size={22} />
              </span>
              <h2 className="font-serif text-2xl font-semibold text-maroon-700">{title}</h2>
              <p className="text-sm text-ink-900/60">{description}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        {SECONDARY.map(({ href, title, Icon }) => (
          <Link
            key={href}
            href={href}
            className="inline-flex items-center gap-2 rounded-full border border-gold-400 px-5 py-2.5 text-sm font-medium text-maroon-700 hover:bg-blush-100"
          >
            <Icon size={15} /> {title}
          </Link>
        ))}
      </div>
    </div>
  );
}
