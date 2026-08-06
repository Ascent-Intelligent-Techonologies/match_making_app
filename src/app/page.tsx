import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,var(--color-blush-200),transparent_60%)]" />

      <div className="relative flex flex-col items-center gap-6">
        <div className="relative h-28 w-28 overflow-hidden rounded-full border border-gold-400/40 bg-blush-100 shadow-lg">
          <Image src="/logo.png" alt="Aura" fill className="object-cover" />
        </div>

        <div>
          <p className="font-serif text-sm uppercase tracking-[0.35em] text-maroon-700">
            Anupama Reddy
          </p>
          <h1 className="font-serif text-6xl font-semibold text-olive-500 sm:text-7xl">
            AURA
          </h1>
          <p className="mt-2 font-script text-2xl italic text-maroon-700">
            Where destiny aligns
          </p>
        </div>

        <p className="max-w-md text-balance text-ink-900/70">
          A private, curated matchmaking service for distinguished families —
          every introduction handled with discretion and care.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/browse">
            <Button size="lg" variant="secondary">
              Browse Profiles
            </Button>
          </Link>
          <Link href="/admin/login">
            <Button size="lg">Admin Login</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
