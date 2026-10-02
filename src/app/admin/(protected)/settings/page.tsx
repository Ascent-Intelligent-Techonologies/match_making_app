import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeSettingsForm } from "@/components/ThemeSettingsForm";
import { getThemeColors } from "@/lib/data/settings";

export const metadata = { title: "Settings | AnuRupa Admin" };

export default async function SettingsPage() {
  const theme = await getThemeColors();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-maroon-700/70 hover:text-maroon-700"
        >
          <ArrowLeft size={15} /> Back
        </Link>
        <h1 className="font-serif text-3xl font-semibold text-maroon-700">Appearance</h1>
        <p className="max-w-2xl text-sm text-ink-900/60">
          These six colours drive every screen — the admin pages, the browse pages and
          the links you share with clients. A change applies immediately, with no
          redeploy.
        </p>
      </div>

      <ThemeSettingsForm initial={theme} />
    </div>
  );
}
