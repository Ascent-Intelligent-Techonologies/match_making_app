import { Suspense } from "react";
import Image from "next/image";
import { LoginForm } from "@/components/LoginForm";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-gold-400/25 bg-white/70 p-8 shadow-lg backdrop-blur-sm">
        <div className="relative mx-auto aspect-square w-full max-w-[200px] overflow-hidden rounded-2xl">
          <Image
            src="/logo-anurupa.jpg"
            alt="AnuRupa Matrimony — Anupama Reddy — Where destiny aligns"
            fill
            sizes="200px"
            className="object-cover"
            priority
          />
        </div>
        <h1 className="mt-3 text-center text-sm uppercase tracking-widest text-maroon-700/70">
          Admin Access
        </h1>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
