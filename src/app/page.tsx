import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,var(--color-blush-200),transparent_60%)]" />

      <div className="relative flex flex-col items-center gap-6">
        <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-3xl shadow-lg">
          <Image
            src="/logo.png"
            alt="Aura — Anupama Reddy — Where destiny aligns"
            fill
            sizes="(max-width: 640px) 100vw, 384px"
            className="object-cover"
            priority
          />
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
