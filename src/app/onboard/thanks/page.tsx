import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export const metadata = { title: "Thank you | AnuRupa Matrimony" };

export default function OnboardThanksPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-gold-400/25 bg-white/70 p-8 text-center shadow-lg backdrop-blur-sm">
        <CheckCircle2 size={44} className="text-olive-600" strokeWidth={1.5} />
        <h1 className="font-serif text-2xl font-semibold text-maroon-700">Thank you</h1>
        <p className="text-sm text-ink-900/70">
          Your profile has been sent to the AnuRupa team. It will be added once they
          have reviewed it.
        </p>
        <Link href="/">
          <Button variant="secondary">Back to home</Button>
        </Link>
      </div>
    </main>
  );
}
