"use client";

import { useActionState, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Field, FieldLabel, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  RELIGIONS,
  DIET_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  MANGLIK_OPTIONS,
  GENDER_OPTIONS,
  CASTE_OPTIONS,
  TAG_OPTIONS,
} from "@/lib/constants";
import type { Profile } from "@/lib/types";
import type { ProfileFormState } from "@/lib/actions/profiles";

/** Sections mirror the intake spreadsheet so data entry matches the paper form. */
const TABS = [
  "Personal",
  "Education",
  "Professional",
  "Family",
  "Contact",
  "Requirements",
  "Internal",
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
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Personal");
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const photosInputRef = useRef<HTMLInputElement>(null);
  const errors = state.fieldErrors ?? {};

  function applyFiles(files: FileList | File[]) {
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;

    const dt = new DataTransfer();
    images.forEach((f) => dt.items.add(f));
    if (photosInputRef.current) {
      photosInputRef.current.files = dt.files;
    }

    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPhotoPreviews(images.map((f) => URL.createObjectURL(f)));
  }

  /** Only the active section is mounted-visible; the rest stay in the DOM so
   *  their values still post with the form. */
  const show = (tab: (typeof TABS)[number]) =>
    activeTab === tab ? "grid gap-5 sm:grid-cols-2" : "hidden";

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-1 rounded-2xl bg-blush-100 p-1.5">
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

      {!profile && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            applyFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col gap-3 rounded-xl border border-dashed p-4 transition-colors ${
            isDragging
              ? "border-maroon-600 bg-blush-200/70"
              : "border-gold-400/50 bg-blush-100/60"
          }`}
        >
          <FieldLabel htmlFor="photos">Photos (optional)</FieldLabel>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-maroon-700">
            <UploadCloud size={18} />
            <span>Choose photos to upload on save, or drag them here</span>
            <input
              ref={photosInputRef}
              id="photos"
              type="file"
              name="photos"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => applyFiles(e.target.files ?? [])}
            />
          </label>
          {photoPreviews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photoPreviews.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={`Selected photo ${i + 1}`}
                  className="h-20 w-20 rounded-lg border border-blush-200 object-cover"
                />
              ))}
            </div>
          )}
          <p className="text-xs text-ink-900/50">
            The first photo becomes the cover. You can add more, reorder and manage them
            after saving.
          </p>
        </div>
      )}

      {/* --- Personal --- */}
      <div className={show("Personal")}>
        <Field label="Gender (Boy / Girl)" htmlFor="gender">
          <Select id="gender" name="gender" defaultValue={profile?.gender ?? ""}>
            <option value="">Select</option>
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name" htmlFor="full_name" error={errors.full_name}>
          <Input id="full_name" name="full_name" defaultValue={profile?.full_name} required />
        </Field>
        <Field label="Surname" htmlFor="surname">
          <Input id="surname" name="surname" defaultValue={profile?.surname ?? ""} />
        </Field>
        <Field label="Date of Birth" htmlFor="dob">
          <Input id="dob" name="dob" type="date" defaultValue={profile?.dob ?? ""} />
        </Field>
        <Field label="Time of Birth" htmlFor="birth_time">
          <Input
            id="birth_time"
            name="birth_time"
            placeholder="e.g. 04:35 AM"
            defaultValue={profile?.birth_time ?? ""}
          />
        </Field>
        <Field label="Place of Birth" htmlFor="birth_place">
          <Input id="birth_place" name="birth_place" defaultValue={profile?.birth_place ?? ""} />
        </Field>
        <Field label="Rasi" htmlFor="rasi">
          <Input id="rasi" name="rasi" defaultValue={profile?.rasi ?? ""} />
        </Field>
        <Field label="Nakshatram" htmlFor="nakshatram">
          <Input id="nakshatram" name="nakshatram" defaultValue={profile?.nakshatram ?? ""} />
        </Field>
        <Field label="Gotram" htmlFor="gotram">
          <Input id="gotram" name="gotram" defaultValue={profile?.gotram ?? ""} />
        </Field>
        <Field label="Caste" htmlFor="caste">
          <Input
            id="caste"
            name="caste"
            list="caste-options"
            defaultValue={profile?.caste ?? ""}
          />
        </Field>
        <datalist id="caste-options">
          {CASTE_OPTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Field label="Sub-Caste" htmlFor="sub_caste">
          <Input id="sub_caste" name="sub_caste" defaultValue={profile?.sub_caste ?? ""} />
        </Field>
        <Field label="Height (cm)" htmlFor="height_cm">
          <Input
            id="height_cm"
            name="height_cm"
            type="number"
            defaultValue={profile?.height_cm ?? ""}
          />
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
        <Field label="Mother Tongue" htmlFor="mother_tongue">
          <Input
            id="mother_tongue"
            name="mother_tongue"
            defaultValue={profile?.mother_tongue ?? ""}
          />
        </Field>
        <Field label="City" htmlFor="city">
          <Input id="city" name="city" defaultValue={profile?.city ?? ""} />
        </Field>
        <Field label="State" htmlFor="state">
          <Input id="state" name="state" defaultValue={profile?.state ?? ""} />
        </Field>
      </div>

      {/* --- Education --- */}
      <div className={show("Education")}>
        <Field label="Degree" htmlFor="education_degree">
          <Input
            id="education_degree"
            name="education_degree"
            defaultValue={profile?.education_degree ?? ""}
          />
        </Field>
        <Field label="University" htmlFor="institution">
          <Input id="institution" name="institution" defaultValue={profile?.institution ?? ""} />
        </Field>
        <Field label="School" htmlFor="school">
          <Input id="school" name="school" defaultValue={profile?.school ?? ""} />
        </Field>
      </div>

      {/* --- Professional --- */}
      <div className={show("Professional")}>
        <Field label="Job" htmlFor="profession">
          <Input id="profession" name="profession" defaultValue={profile?.profession ?? ""} />
        </Field>
        <Field label="Business" htmlFor="business">
          <Input id="business" name="business" defaultValue={profile?.business ?? ""} />
        </Field>
        <Field label="Company" htmlFor="company">
          <Input id="company" name="company" defaultValue={profile?.company ?? ""} />
        </Field>
        <Field label="Salary" htmlFor="salary">
          <Input id="salary" name="salary" defaultValue={profile?.salary ?? ""} />
        </Field>
        <Field label="Citizenship" htmlFor="citizenship">
          <Input id="citizenship" name="citizenship" defaultValue={profile?.citizenship ?? ""} />
        </Field>
        <Field
          label="Finances (annual, INR)"
          htmlFor="annual_income_inr"
          hint="Used for the finances search filter. Never shown to clients."
        >
          <Input
            id="annual_income_inr"
            name="annual_income_inr"
            type="number"
            defaultValue={profile?.annual_income_inr ?? ""}
          />
        </Field>
      </div>

      {/* --- Family --- */}
      <div className={show("Family")}>
        <Field label="Father Name" htmlFor="father_name">
          <Input id="father_name" name="father_name" defaultValue={profile?.father_name ?? ""} />
        </Field>
        <Field label="Father Details" htmlFor="father_profession">
          <Input
            id="father_profession"
            name="father_profession"
            defaultValue={profile?.father_profession ?? ""}
          />
        </Field>
        <Field label="Father — Native place" htmlFor="father_native_place">
          <Input
            id="father_native_place"
            name="father_native_place"
            defaultValue={profile?.father_native_place ?? ""}
          />
        </Field>
        <Field label="Mother Name" htmlFor="mother_name">
          <Input id="mother_name" name="mother_name" defaultValue={profile?.mother_name ?? ""} />
        </Field>
        <Field label="Mother Details" htmlFor="mother_profession">
          <Input
            id="mother_profession"
            name="mother_profession"
            defaultValue={profile?.mother_profession ?? ""}
          />
        </Field>
        <Field label="Mother — Native place" htmlFor="mother_native_place">
          <Input
            id="mother_native_place"
            name="mother_native_place"
            defaultValue={profile?.mother_native_place ?? ""}
          />
        </Field>
        <Field label="Siblings Name" htmlFor="siblings_name">
          <Input
            id="siblings_name"
            name="siblings_name"
            defaultValue={profile?.siblings_name ?? ""}
          />
        </Field>
        <Field label="Number of Siblings" htmlFor="siblings_count">
          <Input
            id="siblings_count"
            name="siblings_count"
            type="number"
            defaultValue={profile?.siblings_count ?? ""}
          />
        </Field>
        <Field label="Siblings Details" htmlFor="siblings_details" >
          <Textarea
            id="siblings_details"
            name="siblings_details"
            defaultValue={profile?.siblings_details ?? ""}
          />
        </Field>
        <Field label="Current Address" htmlFor="current_address">
          <Textarea
            id="current_address"
            name="current_address"
            defaultValue={profile?.current_address ?? ""}
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

      {/* --- Contact --- */}
      <div className={show("Contact")}>
        <Field label="Primary contact" htmlFor="contact_phone">
          <Input id="contact_phone" name="contact_phone" defaultValue={profile?.contact_phone ?? ""} />
        </Field>
        <Field
          label="Middlemen contact"
          htmlFor="middlemen_contact"
          hint="Admin-only. Never shown to clients."
        >
          <Input
            id="middlemen_contact"
            name="middlemen_contact"
            defaultValue={profile?.middlemen_contact ?? ""}
          />
        </Field>
        <Field label="Contact Email" htmlFor="contact_email" error={errors.contact_email}>
          <Input
            id="contact_email"
            name="contact_email"
            type="email"
            defaultValue={profile?.contact_email ?? ""}
          />
        </Field>
      </div>

      {/* --- Requirements --- */}
      <div className={show("Requirements")}>
        <Field
          label="Requirements"
          htmlFor="partner_expectations"
          hint="Shown in search results and on shared profiles."
        >
          <Textarea
            id="partner_expectations"
            name="partner_expectations"
            defaultValue={profile?.partner_expectations ?? ""}
          />
        </Field>
        <Field label="Marital Status" htmlFor="marital_status">
          <Select
            id="marital_status"
            name="marital_status"
            defaultValue={profile?.marital_status ?? ""}
          >
            <option value="">Select</option>
            {MARITAL_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
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
        <Field label="Horoscope Notes" htmlFor="horoscope_notes">
          <Textarea
            id="horoscope_notes"
            name="horoscope_notes"
            defaultValue={profile?.horoscope_notes ?? ""}
          />
        </Field>
      </div>

      {/* --- Internal --- */}
      <div className={show("Internal")}>
        <p className="text-xs text-ink-900/50 sm:col-span-2">
          These fields are always admin-only and are never shown to clients, even with an
          &ldquo;All details&rdquo; share link.
        </p>
        <Field label="Tag" htmlFor="tag">
          <Select id="tag" name="tag" defaultValue={profile?.tag ?? ""}>
            <option value="">Select</option>
            {TAG_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Net Worth / Assets Notes" htmlFor="net_worth_notes">
          <Textarea
            id="net_worth_notes"
            name="net_worth_notes"
            defaultValue={profile?.net_worth_notes ?? ""}
          />
        </Field>
        <Field label="Private Admin Notes" htmlFor="owner_private_notes">
          <Textarea
            id="owner_private_notes"
            name="owner_private_notes"
            defaultValue={profile?.owner_private_notes ?? ""}
          />
        </Field>
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
