import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, LayoutGrid, Link2 } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/auth/session";
import { logoutAction } from "@/lib/actions/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-gold-400/20 bg-blush-50/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/admin" className="font-serif text-2xl font-semibold text-olive-500">
            AURA <span className="text-xs font-sans uppercase tracking-widest text-maroon-700/60">Admin</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-maroon-700 hover:bg-blush-100"
            >
              <LayoutGrid size={15} /> Profiles
            </Link>
            <Link
              href="/admin/links"
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-maroon-700 hover:bg-blush-100"
            >
              <Link2 size={15} /> Share Links
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-maroon-700/70 hover:bg-blush-100 cursor-pointer"
              >
                <LogOut size={15} /> Logout
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
