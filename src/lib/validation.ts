import { z } from "zod";
import { isUsablePhone } from "@/lib/phone";

const emptyToUndefined = (val: unknown) =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

const optionalString = z.preprocess(emptyToUndefined, z.string().trim().optional());
const optionalNumber = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
  z.number().finite().optional()
);

export const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required"),
  gender: z.enum(["male", "female"]).optional(),
  dob: optionalString,
  height_cm: optionalNumber,
  city: optionalString,
  state: optionalString,
  country: optionalString,
  religion: optionalString,
  caste: optionalString,
  sub_caste: optionalString,
  native_place: optionalString,
  // Unlike the other optional strings, a blank box becomes null rather than
  // undefined. The save step drops undefined (a blank field keeps its stored
  // value), but this one is free text and has to be erasable; null is what
  // clears a column.
  additional_details: z.preprocess(
    (val) => (typeof val === "string" && val.trim() === "" ? null : val),
    z.string().trim().nullable().optional()
  ),
  mother_tongue: optionalString,
  surname: optionalString,
  rasi: optionalString,
  nakshatram: optionalString,
  gotram: optionalString,

  education_degree: optionalString,
  institution: optionalString,
  school: optionalString,
  profession: optionalString,
  company: optionalString,
  business: optionalString,
  salary: optionalString,
  citizenship: optionalString,
  annual_income_inr: optionalNumber,

  father_name: optionalString,
  father_profession: optionalString,
  father_native_place: optionalString,
  mother_name: optionalString,
  mother_profession: optionalString,
  mother_native_place: optionalString,
  family_status_notes: optionalString,
  current_address: optionalString,

  birth_time: optionalString,
  birth_place: optionalString,
  star_sign: optionalString,

  hobbies: z.array(z.string()).optional(),
  partner_expectations: optionalString,

  profession_category: optionalString,
  urgent: z.boolean().optional(),
  sibling1_name: optionalString,
  sibling1_status: optionalString,
  sibling1_details: optionalString,
  sibling1_potential_client: z.boolean().optional(),
  sibling2_name: optionalString,
  sibling2_status: optionalString,
  sibling2_details: optionalString,
  sibling2_potential_client: z.boolean().optional(),

  net_worth_notes: optionalString,
  tags: z.array(z.string()).optional(),
  anurupa_aura: z.boolean().optional(),

  primary_contact_name: optionalString,
  primary_contact_relation: optionalString,
  contact_phone: optionalString,
  middlemen_contact_name: optionalString,
  middlemen_contact_number: optionalString,
  contact_email: z.preprocess(
    emptyToUndefined,
    z.string().trim().email().optional()
  ),
  owner_private_notes: optionalString,

  is_active: z.boolean().optional(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

/** A real calendar date (YYYY-MM-DD) between 1900 and today. */
function isRealPastDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value >= "1900-01-01" &&
    parsed.getTime() <= Date.now()
  );
}

/**
 * What the public self-onboarding form may set: the profile form minus
 * everything internal. The omitted keys are exactly the admin-only fields of
 * ADMIN_ONLY_FIELDS that the form has (plus is_active), so a request that
 * posts one anyway has it dropped here rather than stored; it does not matter
 * that the page never showed it.
 *
 * Name and phone are required (an admin can leave either blank). Photos are
 * required too, but they are not part of this form data: the submission is
 * not accepted until one has been uploaded (see completeOnboarding).
 *
 * Stricter than the admin schema where a stranger is typing: bounded lengths,
 * a real date of birth, a plausible height.
 */
export const selfOnboardingSchema = profileSchema
  .omit({
    net_worth_notes: true,
    owner_private_notes: true,
    additional_details: true,
    middlemen_contact_number: true,
    middlemen_contact_name: true,
    annual_income_inr: true,
    tags: true,
    anurupa_aura: true,
    urgent: true,
    sibling1_potential_client: true,
    sibling2_potential_client: true,
    is_active: true,
  })
  .extend({
    full_name: z.string().trim().min(1, "Please enter your name").max(200),
    contact_phone: z
      .string()
      .trim()
      .min(1, "Please enter your phone number")
      .refine(isUsablePhone, "Enter a valid phone number"),
    // The admin form makes the person pick one; here only name, phone and a
    // photo are required, so an untouched "Select" has to be allowed through.
    gender: z.preprocess(emptyToUndefined, z.enum(["male", "female"]).optional()),
    dob: z.preprocess(
      emptyToUndefined,
      z.string().trim().refine(isRealPastDate, "Enter a valid date of birth").optional()
    ),
    height_cm: z.preprocess(
      (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
      z.number().min(90, "Check the height").max(250, "Check the height").optional()
    ),
  });

export type SelfOnboardingValues = z.infer<typeof selfOnboardingSchema>;

export const shareLinkSchema = z.object({
  profileIds: z.array(z.string().uuid()).min(1, "Select at least one profile"),
  accessLevel: z.enum(["photos_only", "partial", "full"]),
  label: z.string().trim().optional(),
  // Shown to the family at the top of the share page.
  notes: z.string().trim().max(2000).optional(),
  // Optional: name the client here and the link is attributed to them. Leave
  // both blank and whoever opens the link is asked before they can shortlist.
  clientName: optionalString,
  // A client already on the list, picked or searched for: the link goes to
  // them as they are, which is the only way to reach one with no number.
  clientId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  clientPhone: z.preprocess(
    emptyToUndefined,
    z.string().trim().refine(isUsablePhone, "Enter a valid phone number").optional()
  ),
});

export type ShareLinkFormValues = z.infer<typeof shareLinkSchema>;
