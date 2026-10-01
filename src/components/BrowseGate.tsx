"use client";

import { useActionState } from "react";
import Image from "next/image";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { startBrowsingAction, type BrowseGateState } from "@/lib/actions/browse";

/** Shown before any profiles are visible, so browsing is always attributed. */
export function BrowseGate() {
  const [state, formAction, pending] = useActionState<BrowseGateState, FormData>(
    startBrowsingAction,
    {}
  );

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-gold-400/25 bg-white/70 p-8 shadow-lg backdrop-blur-sm">
        <div className="relative mx-auto aspect-square w-full max-w-[160px] overflow-hidden rounded-2xl">
          <Image
            src="/logo-anurupa.jpg"
            alt="AnuRupa Matrimony"
            fill
            sizes="160px"
            className="object-cover"
            priority
          />
        </div>

        <h1 className="mt-4 text-center font-serif text-2xl font-semibold text-maroon-700">
          Before you begin
        </h1>
        <p className="mt-1 text-center text-sm text-ink-900/60">
          Tell us who you are so we can keep track of the profiles you like.
        </p>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <Field label="Your name" htmlFor="fullName">
            <Input id="fullName" name="fullName" required autoFocus placeholder="e.g. Rao family" />
          </Field>
          <Field label="Phone number" htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              required
              inputMode="tel"
              placeholder="e.g. +91 98765 43210"
            />
          </Field>

          {state.error && <p className="text-sm text-red-700">{state.error}</p>}

          <Button type="submit" className="mt-2 w-full" disabled={pending}>
            {pending ? "Starting…" : "Browse profiles"}
          </Button>
        </form>
      </div>
    </main>
  );
}
