"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { loginAction, type LoginState } from "@/lib/actions/auth";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/owner";
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {}
  );

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" required autoFocus />
      </Field>

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}

      <Button type="submit" className="mt-2 w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
