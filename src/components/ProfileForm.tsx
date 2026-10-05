"use client";

import { useActionState, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Field, FieldLabel, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  CASTE_OPTIONS,
  COUNTRY_OPTIONS,
  GENDER_OPTIONS,
  PROFESSION_CATEGORIES,
  RELIGIONS,
  SIBLING_STATUS_OPTIONS,
  STATES_BY_COUNTRY,
  TAG_OPTIONS,
} from "@/lib/constants";
import { cmToFeetInches } from "@/lib/format";
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
  // Only India and the USA have a state list; everywhere else the field stays
  // free text, so the country has to be tracked rather than read on submit.
  const [country, setCountry] = useState(profile?.country ?? "");
  const errors = state.fieldErrors ?? {};
  const height = cmToFeetInches(profile?.height_cm);
  const states = STATES_BY_COUNTRY[country];

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

  /** For sections that lay their own fields out rather than flowing in a grid. */
  const panel = (tab: (typeof TABS)[number]) =>
    activeTab === tab ? "flex flex-col gap-5" : "hidden";

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
      {/* Laid out in two fixed columns to match the paper form: the person on
          the left, their lineage and birth details on the right. */}
      <div className={panel("Personal")}>
        <div className="sm:max-w-xs">
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
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-5">
            <Field label="Name" htmlFor="full_name" error={errors.full_name}>
              <Input id="full_name" name="full_name" defaultValue={profile?.full_name} required />
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
            <Field label="Height" htmlFor="height_feet">
              <div className="flex items-center gap-2">
                <Input
                  id="height_feet"
                  name="height_feet"
                  type="number"
                  min={0}
                  max={8}
                  placeholder="Feet"
                  defaultValue={height?.feet ?? ""}
                />
                <Input
                  id="height_inches"
                  name="height_inches"
                  type="number"
                  min={0}
                  max={11}
                  placeholder="Inches"
                  defaultValue={height?.inches ?? ""}
                />
              </div>
            </Field>
            <Field
              label="Native place"
              htmlFor="native_place"
              hint="Shared at every level, per the intake sheet."
            >
              <Input
                id="native_place"
                name="native_place"
                defaultValue={profile?.native_place ?? ""}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-5">
            <Field label="Surname" htmlFor="surname">
              <Input id="surname" name="surname" defaultValue={profile?.surname ?? ""} />
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
            <Field label="Gotram" htmlFor="gotram">
              <Input id="gotram" name="gotram" defaultValue={profile?.gotram ?? ""} />
            </Field>
            <Field label="Nakshatram" htmlFor="nakshatram">
              <Input id="nakshatram" name="nakshatram" defaultValue={profile?.nakshatram ?? ""} />
            </Field>
            <Field label="Rasi" htmlFor="rasi">
              <Input id="rasi" name="rasi" defaultValue={profile?.rasi ?? ""} />
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
          </div>
        </div>

        <div className="grid gap-5 border-t border-blush-200 pt-5 sm:grid-cols-3">
          <Field label="Current location" htmlFor="country">
            <Select
              id="country"
              name="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="">Select</option>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="State"
            htmlFor="state"
            hint={states ? undefined : "Free text outside India and the USA."}
          >
            {states ? (
              <Select
                id="state"
                name="state"
                // Remounting on a country change drops a state that belonged to
                // the previous country rather than posting a mismatched pair.
                key={country}
                defaultValue={profile?.country === country ? (profile?.state ?? "") : ""}
              >
                <option value="">Select</option>
                {states.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </Select>
            ) : (
              <Input id="state" name="state" defaultValue={profile?.state ?? ""} />
            )}
          </Field>

          <Field label="City" htmlFor="city">
            <Input id="city" name="city" defaultValue={profile?.city ?? ""} />
          </Field>
        </div>
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
        <Field
          label="Job category"
          htmlFor="profession_category"
          hint="Drives the job filter in search."
        >
          <Select
            id="profession_category"
            name="profession_category"
            defaultValue={profile?.profession_category ?? ""}
          >
            <option value="">Select</option>
            {PROFESSION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
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
      <div className={panel("Family")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-5">
            <Field label="Father" htmlFor="father_name">
              <Input id="father_name" name="father_name" defaultValue={profile?.father_name ?? ""} />
            </Field>
            <Field label="Father details — occupation" htmlFor="father_profession">
              <Input
                id="father_profession"
                name="father_profession"
                defaultValue={profile?.father_profession ?? ""}
              />
            </Field>
            <Field label="Father — native place" htmlFor="father_native_place">
              <Input
                id="father_native_place"
                name="father_native_place"
                defaultValue={profile?.father_native_place ?? ""}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-5">
            <Field label="Mother" htmlFor="mother_name">
              <Input id="mother_name" name="mother_name" defaultValue={profile?.mother_name ?? ""} />
            </Field>
            <Field label="Mother details — occupation" htmlFor="mother_profession">
              <Input
                id="mother_profession"
                name="mother_profession"
                defaultValue={profile?.mother_profession ?? ""}
              />
            </Field>
            <Field label="Mother — native place" htmlFor="mother_native_place">
              <Input
                id="mother_native_place"
                name="mother_native_place"
                defaultValue={profile?.mother_native_place ?? ""}
              />
            </Field>
          </div>
        </div>

        {/* Each sibling gets their own block. An unmarried sibling is someone we
            may end up matchmaking for, which is what "potential client" marks. */}
        {([1, 2] as const).map((n) => {
          const name = profile?.[`sibling${n}_name`] ?? "";
          const status = profile?.[`sibling${n}_status`] ?? "";
          const details = profile?.[`sibling${n}_details`] ?? "";
          const potential = profile?.[`sibling${n}_potential_client`] ?? false;
          return (
            <div
              key={n}
              className="grid gap-5 border-t border-blush-200 pt-5 sm:grid-cols-2"
            >
              <div className="flex flex-col gap-5">
                <Field label={`Sibling ${n}`} htmlFor={`sibling${n}_name`}>
                  <Input
                    id={`sibling${n}_name`}
                    name={`sibling${n}_name`}
                    defaultValue={name}
                  />
                </Field>
                <Field label="Marital status" htmlFor={`sibling${n}_status`}>
                  <Select
                    id={`sibling${n}_status`}
                    name={`sibling${n}_status`}
                    defaultValue={status}
                  >
                    <option value="">Select</option>
                    {SIBLING_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <label className="flex items-center gap-2 text-sm text-ink-900/70">
                  <input
                    type="checkbox"
                    name={`sibling${n}_potential_client`}
                    defaultChecked={potential}
                    className="h-4 w-4 rounded border-blush-300 text-maroon-600 focus:ring-maroon-600"
                  />
                  Potential client
                </label>
              </div>

              <Field label={`Sibling ${n} details`} htmlFor={`sibling${n}_details`}>
                <Textarea
                  id={`sibling${n}_details`}
                  name={`sibling${n}_details`}
                  defaultValue={details}
                />
              </Field>
            </div>
          );
        })}

        <div className="grid gap-5 border-t border-blush-200 pt-5 sm:grid-cols-2">
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
      </div>

      {/* --- Contact --- */}
      <div className={panel("Contact")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-5">
            <Field label="Primary contact name" htmlFor="primary_contact_name">
              <Input
                id="primary_contact_name"
                name="primary_contact_name"
                defaultValue={profile?.primary_contact_name ?? ""}
              />
            </Field>
            <Field
              label="Relation"
              htmlFor="primary_contact_relation"
              hint="How they are related, e.g. father, uncle, sister."
            >
              <Input
                id="primary_contact_relation"
                name="primary_contact_relation"
                defaultValue={profile?.primary_contact_relation ?? ""}
              />
            </Field>
          </div>

          <Field label="Primary contact number" htmlFor="contact_phone">
            <Input
              id="contact_phone"
              name="contact_phone"
              defaultValue={profile?.contact_phone ?? ""}
            />
          </Field>
        </div>

        <div className="grid gap-5 border-t border-blush-200 pt-5 sm:grid-cols-2">
          <Field
            label="Middlemen contact name"
            htmlFor="middlemen_contact_name"
            hint="Admin-only. Never shown to clients."
          >
            <Input
              id="middlemen_contact_name"
              name="middlemen_contact_name"
              defaultValue={profile?.middlemen_contact_name ?? ""}
            />
          </Field>
          <Field
            label="Middlemen contact number"
            htmlFor="middlemen_contact_number"
            hint="Admin-only. Never shown to clients."
          >
            <Input
              id="middlemen_contact_number"
              name="middlemen_contact_number"
              defaultValue={profile?.middlemen_contact_number ?? ""}
            />
          </Field>
        </div>

        <div className="sm:max-w-md">
          <Field label="Contact Email" htmlFor="contact_email" error={errors.contact_email}>
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              defaultValue={profile?.contact_email ?? ""}
            />
          </Field>
        </div>
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

        <label className="flex items-start gap-2 self-start rounded-xl border border-gold-400/40 bg-gold-400/10 p-3 text-sm text-ink-900/80 sm:col-span-2">
          <input
            type="checkbox"
            name="urgent"
            defaultChecked={profile?.urgent ?? false}
            className="mt-0.5 h-4 w-4 rounded border-blush-300 text-maroon-600 focus:ring-maroon-600"
          />
          <span>
            <span className="font-semibold">Urgent</span>
            <span className="block text-xs text-ink-900/60">
              Marks this profile as a priority. Filterable in All Profiles and search;
              never shown to clients.
            </span>
          </span>
        </label>
      </div>

      {/* --- Internal --- */}
      <div className={show("Internal")}>
        <p className="text-xs text-ink-900/50 sm:col-span-2">
          These fields are always admin-only and are never shown to clients, even with an
          &ldquo;All details&rdquo; share link.
        </p>
        {/* Checkboxes rather than a multi-select list: there are only three,
            and every one is visible without opening anything. */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <FieldLabel>Anurupa tag</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map((t) => (
              <label
                key={t}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-blush-200 bg-white/60 px-3 py-2 text-sm text-ink-900/80"
              >
                <input
                  type="checkbox"
                  name="tags"
                  value={t}
                  defaultChecked={(profile?.tags ?? []).includes(t)}
                  className="h-4 w-4 rounded border-blush-300 text-maroon-600 focus:ring-maroon-600"
                />
                {t}
              </label>
            ))}
          </div>
          <p className="text-xs text-ink-900/50">Select one or more.</p>
        </div>

        <label className="flex items-start gap-2 self-start rounded-xl border border-gold-400/40 bg-gold-400/10 p-3 text-sm text-ink-900/80 sm:col-span-2">
          <input
            type="checkbox"
            name="anurupa_aura"
            defaultChecked={profile?.anurupa_aura ?? false}
            className="mt-0.5 h-4 w-4 rounded border-blush-300 text-maroon-600 focus:ring-maroon-600"
          />
          <span>
            <span className="font-semibold">Anurupa Aura</span>
            <span className="block text-xs text-ink-900/60">
              Filterable in All Profiles and search. Never shown to clients.
            </span>
          </span>
        </label>
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
