import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-gold-400/25 bg-white/70 p-8 shadow-lg backdrop-blur-sm">
        <p className="text-center font-serif text-3xl font-semibold text-olive-500">AURA</p>
        <h1 className="mt-1 text-center text-sm uppercase tracking-widest text-maroon-700/70">
          Admin Access
        </h1>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}

