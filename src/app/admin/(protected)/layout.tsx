import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { isAdminAuthenticated } from "@/lib/auth/session";
import { logoutAction } from "@/lib/actions/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authenticated = await isAdminAuthenticated();
  if (!authenticated) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      {/* Navigation lives on the home screen's section cards, so the header
          stays minimal: a way home and a way out. */}
      <header className="sticky top-0 z-10 border-b border-gold-400/20 bg-blush-50/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
              <Image src="/logo-anurupa.jpg" alt="" fill sizes="36px" className="object-cover" />
            </span>
            <span className="font-serif text-xl font-semibold text-olive-500">
              AnuRupa{" "}
              <span className="font-sans text-xs uppercase tracking-widest text-maroon-700/60">
                Admin
              </span>
            </span>
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Logout"
              className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-maroon-700/70 hover:bg-blush-100"
            >
              <LogOut size={15} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
