"use client";

import { useEffect, useRef, useState } from "react";
import { Input, Select } from "@/components/ui/Field";
import { DEFAULT_PHONE_REGION, PHONE_REGIONS, joinPhone, phoneProblem } from "@/lib/phone";

/**
 * A phone field with the region chosen separately and India preselected.
 *
 * The form still receives one value under `name` ("+91 98765 43210"), exactly
 * what a visitor would have typed in a single box, so nothing that reads it
 * has to change. The two visible controls carry no name of their own.
 */
export function PhoneInput({ id, name }: { id: string; name: string }) {
  const [regionId, setRegionId] = useState(DEFAULT_PHONE_REGION.id);
  const [typed, setTyped] = useState("");
  const numberRef = useRef<HTMLInputElement>(null);

  const region = PHONE_REGIONS.find((r) => r.id === regionId) ?? DEFAULT_PHONE_REGION;

  // The browser's own validation bubble, so a short number is caught before
  // the form is sent rather than after.
  const problem = phoneProblem(region, typed);
  useEffect(() => {
    numberRef.current?.setCustomValidity(problem ?? "");
  }, [problem]);

  return (
    <div className="flex gap-2">
      <div className="w-32 shrink-0">
        <Select
          aria-label="Region"
          value={regionId}
          onChange={(e) => setRegionId(e.target.value)}
        >
          {PHONE_REGIONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="min-w-0 flex-1">
        <Input
          ref={numberRef}
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={region.placeholder}
        />
      </div>
      <input type="hidden" name={name} value={joinPhone(region, typed)} />
    </div>
  );
}
