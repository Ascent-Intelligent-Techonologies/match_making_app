import Image from "next/image";
import { SelfOnboardForm } from "@/components/SelfOnboardForm";

export const metadata = {
  title: "Create your profile | AnuRupa Matrimony",
  description: "Tell us about yourself and add a photo. Our team reviews every profile before it is added.",
};

/**
 * The public self-onboarding page. Open to anyone: no sign-in, and no link
 * from the admin side. What a submission does and does not reach is decided on
 * the server (src/lib/actions/onboarding.ts); a profile made here is held for
 * an admin to approve and appears nowhere until then.
 */
export default function OnboardPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="relative h-20 w-20 overflow-hidden rounded-2xl">
          <Image
            src="/logo-anurupa-v1-400.webp"
            alt="AnuRupa Matrimony"
            fill
            sizes="80px"
            className="object-cover"
            priority
            unoptimized
          />
        </span>
        <h1 className="font-serif text-3xl font-semibold text-maroon-700">Create your profile</h1>
        <p className="max-w-xl text-sm text-ink-900/70">
          Fill in as much as you are comfortable sharing. Your name, phone number and at
          least one photo are required; everything else is optional.
        </p>
      </header>

      <div className="rounded-2xl border border-gold-400/25 bg-white/70 p-4 shadow-sm backdrop-blur-sm sm:p-6">
        <SelfOnboardForm />
      </div>

      <p className="text-center text-xs text-ink-900/50">
        Every profile is reviewed by the AnuRupa team before it is added.
      </p>
    </main>
  );
}
