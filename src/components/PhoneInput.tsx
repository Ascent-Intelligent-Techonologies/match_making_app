"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/Field";
import { COUNTRY_CODE, joinPhone, phoneProblem } from "@/lib/phone";

/**
 * A phone field with +91 already in front of it.
 *
 * The form still receives one value under `name` ("+91 98765 43210"), exactly
 * what a visitor would have typed in a single box, so nothing that reads it
 * has to change. The visible number box carries no name of its own.
 */
export function PhoneInput({ id, name }: { id: string; name: string }) {
  const [typed, setTyped] = useState("");
  const numberRef = useRef<HTMLInputElement>(null);

  // The browser's own validation bubble, so a short number is caught before
  // the form is sent rather than after.
  const problem = phoneProblem(typed);
  useEffect(() => {
    numberRef.current?.setCustomValidity(problem ?? "");
  }, [problem]);

  return (
    <div className="flex gap-2">
      <span
        aria-hidden
        className="flex items-center rounded-lg border border-blush-300 bg-white/70 px-3.5 text-[15px] text-ink-900/70"
      >
        {COUNTRY_CODE}
      </span>
      <div className="min-w-0 flex-1">
        <Input
          ref={numberRef}
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-label={`Phone number, after ${COUNTRY_CODE}`}
          required
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="98765 43210"
        />
      </div>
      <input type="hidden" name={name} value={joinPhone(typed)} />
    </div>
  );
}
