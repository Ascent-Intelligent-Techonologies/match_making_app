"use client";

import { useActionState, useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  RELIGIONS,
  DIET_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  MANGLIK_OPTIONS,
  GENDER_OPTIONS,
} from "@/lib/constants";
import type { Profile } from "@/lib/types";
import type { ProfileFormState } from "@/lib/actions/profiles";

const TABS = [
  "Basic",
  "Education & Career",
  "Family Background",
  "Horoscope",
  "Lifestyle",
  "Confidential",
] as const;

type ActionFn = (
  state: ProfileFormState,
  formData: FormData
) => Promise<ProfileFormState>;

export function ProfileForm({
  profile,
  action,
  submitLabel,
}: {
  profile?: Profile;
  action: ActionFn;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(
    action,
    {}
  );
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Basic");
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-1 rounded-full bg-blush-100 p-1.5">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab
                ? "bg-maroon-600 text-blush-50 shadow-sm"
                : "text-maroon-700/70 hover:bg-white/60"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-700/10 px-4 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className={activeTab === "Basic" ? "grid gap-5 sm:grid-cols-2" : "hidden"}>
        <Field label="Full Name" htmlFor="full_name" error={errors.full_name}>
          <Input id="full_name" name="full_name" defaultValue={profile?.full_name} required />
        </Field>
        <Field label="Profile For" htmlFor="gender">
          <Select id="gender" name="gender" defaultValue={profile?.gender ?? ""}>
            <option value="">Select</option>
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date of Birth" htmlFor="dob">
          <Input id="dob" name="dob" type="date" defaultValue={profile?.dob ?? ""} />
        </Field>
        <Field label="Height (cm)" htmlFor="height_cm">
          <Input
            id="height_cm"
            name="height_cm"
            type="number"
            min={100}
            max={250}
            defaultValue={profile?.height_cm ?? ""}
          />
        </Field>
        <Field label="City" htmlFor="city">
          <Input id="city" name="city" defaultValue={profile?.city ?? ""} />
        </Field>
        <Field label="State" htmlFor="state">
          <Input id="state" name="state" defaultValue={profile?.state ?? ""} />
        </Field>
        <Field label="Country" htmlFor="country">
          <Input id="country" name="country" defaultValue={profile?.country ?? "India"} />
        </Field>
        <Field label="Marital Status" htmlFor="marital_status">
          <Select id="marital_status" name="marital_status" defaultValue={profile?.marital_status ?? ""}>
            <option value="">Select</option>
            {MARITAL_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Religion" htmlFor="religion">
          <Select id="religion" name="religion" defaultValue={profile?.religion ?? ""}>
            <option value="">Select</option>
            {RELIGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Caste" htmlFor="caste">
          <Input id="caste" name="caste" defaultValue={profile?.caste ?? ""} />
        </Field>
        <Field label="Mother Tongue" htmlFor="mother_tongue">
          <Input id="mother_tongue" name="mother_tongue" defaultValue={profile?.mother_tongue ?? ""} />
        </Field>
      </div>

      <div className={activeTab === "Education & Career" ? "grid gap-5 sm:grid-cols-2" : "hidden"}>
        <Field label="Highest Education" htmlFor="education_degree">
          <Input id="education_degree" name="education_degree" defaultValue={profile?.education_degree ?? ""} />
        </Field>
        <Field label="Institution" htmlFor="institution">
          <Input id="institution" name="institution" defaultValue={profile?.institution ?? ""} />
        </Field>
        <Field label="Profession" htmlFor="profession">
          <Input id="profession" name="profession" defaultValue={profile?.profession ?? ""} />
        </Field>
        <Field label="Company / Business" htmlFor="company">
          <Input id="company" name="company" defaultValue={profile?.company ?? ""} />
        </Field>
        <Field label="Annual Income (INR)" htmlFor="annual_income_inr" hint="Used for filtering only">
          <Input
            id="annual_income_inr"
            name="annual_income_inr"
            type="number"
            min={0}
            defaultValue={profile?.annual_income_inr ?? ""}
          />
        </Field>
      </div>

      <div className={activeTab === "Family Background" ? "grid gap-5 sm:grid-cols-2" : "hidden"}>
        <Field label="Father's Profession" htmlFor="father_profession">
          <Input id="father_profession" name="father_profession" defaultValue={profile?.father_profession ?? ""} />
        </Field>
        <Field label="Mother's Profession" htmlFor="mother_profession">
          <Input id="mother_profession" name="mother_profession" defaultValue={profile?.mother_profession ?? ""} />
        </Field>
        <Field label="Number of Siblings" htmlFor="siblings_count">
          <Input
            id="siblings_count"
            name="siblings_count"
            type="number"
            min={0}
            defaultValue={profile?.siblings_count ?? ""}
          />
        </Field>
        <Field
          label="Family Background & Status"
          htmlFor="family_status_notes"
          hint="Lineage, family reputation, notable relatives, etc."
        >
          <Textarea
            id="family_status_notes"
            name="family_status_notes"
            defaultValue={profile?.family_status_notes ?? ""}
          />
        </Field>
      </div>

      <div className={activeTab === "Horoscope" ? "grid gap-5 sm:grid-cols-2" : "hidden"}>
        <Field label="Birth Time" htmlFor="birth_time">
          <Input id="birth_time" name="birth_time" placeholder="e.g. 04:35 AM" defaultValue={profile?.birth_time ?? ""} />
        </Field>
        <Field label="Birth Place" htmlFor="birth_place">
          <Input id="birth_place" name="birth_place" defaultValue={profile?.birth_place ?? ""} />
        </Field>
        <Field label="Star Sign / Nakshatra" htmlFor="star_sign">
          <Input id="star_sign" name="star_sign" defaultValue={profile?.star_sign ?? ""} />
        </Field>
        <Field label="Manglik Status" htmlFor="manglik">
          <Select id="manglik" name="manglik" defaultValue={profile?.manglik ?? ""}>
            <option value="">Select</option>
            {MANGLIK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Horoscope Notes" htmlFor="horoscope_notes">
            <Textarea id="horoscope_notes" name="horoscope_notes" defaultValue={profile?.horoscope_notes ?? ""} />
          </Field>
        </div>
      </div>

      <div className={activeTab === "Lifestyle" ? "grid gap-5 sm:grid-cols-2" : "hidden"}>
        <Field label="Hobbies & Interests" htmlFor="hobbies" hint="Comma-separated">
          <Input
            id="hobbies"
            name="hobbies"
            defaultValue={profile?.hobbies?.join(", ") ?? ""}
            placeholder="Golf, travel, classical music"
          />
        </Field>
        <Field label="Diet" htmlFor="diet">
          <Select id="diet" name="diet" defaultValue={profile?.diet ?? ""}>
            <option value="">Select</option>
            {DIET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Partner Expectations" htmlFor="partner_expectations">
            <Textarea
              id="partner_expectations"
              name="partner_expectations"
              defaultValue={profile?.partner_expectations ?? ""}
            />
          </Field>
        </div>
      </div>

      <div className={activeTab === "Confidential" ? "grid gap-5 sm:grid-cols-2" : "hidden"}>
        <p className="sm:col-span-2 text-xs text-ink-900/50">
          These fields are always owner-only and are never shown to clients, even with a
          &quot;Full&quot; access share link.
        </p>
        <Field label="Contact Phone" htmlFor="contact_phone">
          <Input id="contact_phone" name="contact_phone" defaultValue={profile?.contact_phone ?? ""} />
        </Field>
        <Field label="Contact Email" htmlFor="contact_email" error={errors.contact_email}>
          <Input id="contact_email" name="contact_email" type="email" defaultValue={profile?.contact_email ?? ""} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Net Worth / Assets Notes" htmlFor="net_worth_notes">
            <Textarea id="net_worth_notes" name="net_worth_notes" defaultValue={profile?.net_worth_notes ?? ""} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Private Owner Notes" htmlFor="owner_private_notes">
            <Textarea
              id="owner_private_notes"
              name="owner_private_notes"
              defaultValue={profile?.owner_private_notes ?? ""}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-900/70 sm:col-span-2">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={profile?.is_active ?? true}
            className="h-4 w-4 rounded border-blush-300 text-maroon-600 focus:ring-maroon-600"
          />
          Active (visible in dashboard search)
        </label>
      </div>

      <div className="flex justify-end border-t border-blush-200 pt-5">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
