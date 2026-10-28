"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ClientPicker } from "@/components/ClientPicker";
import { startSearchForClientAction, type ClientFormState } from "@/lib/actions/clients";

/** Every search runs on behalf of a client, so we pick one before searching. */
export function ClientChooser() {
  const router = useRouter();
  const [opening, startOpening] = useTransition();
  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(
    startSearchForClientAction,
    {}
  );

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-gold-400/25 bg-white/60 p-6">
      <div>
        <h2 className="font-serif text-xl font-semibold text-maroon-700">
          Who are we searching for?
        </h2>
        <p className="text-sm text-ink-900/60">
          Pick an existing client, or add the person you are shortlisting for.
        </p>
      </div>

      <Field
        label="Existing client"
        htmlFor="existing"
        hint={opening ? "Opening their search…" : undefined}
      >
        <ClientPicker
          id="existing"
          placeholder="Search by name or number…"
          disabled={opening}
          onSelect={(c) => startOpening(() => router.push(`/admin/search?client=${c.id}`))}
        />
      </Field>

      <form action={formAction} className="flex flex-col gap-4 border-t border-blush-200 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
          Or add a new client
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client name" htmlFor="fullName">
            <Input id="fullName" name="fullName" required placeholder="e.g. Sharma family" />
          </Field>
          <Field label="Client phone" htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              required
              inputMode="tel"
              placeholder="e.g. +91 98765 43210"
            />
          </Field>
        </div>
        {state.error && <p className="text-xs text-red-700">{state.error}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            <UserPlus size={15} /> {pending ? "Starting…" : "Start search"}
          </Button>
        </div>
      </form>
    </div>
  );
}
