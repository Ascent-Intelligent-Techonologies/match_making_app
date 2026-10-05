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
  siblings_count: optionalNumber,
  siblings_name: optionalString,
  siblings_details: optionalString,
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
  tag: optionalString,
  contact_phone: optionalString,
  middlemen_contact: optionalString,
  contact_email: z.preprocess(
    emptyToUndefined,
    z.string().trim().email().optional()
  ),
  owner_private_notes: optionalString,

  is_active: z.boolean().optional(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export const shareLinkSchema = z.object({
  profileIds: z.array(z.string().uuid()).min(1, "Select at least one profile"),
  accessLevel: z.enum(["photos_only", "partial", "full"]),
  expiryDays: z.coerce.number().int().min(1).max(90),
  label: z.string().trim().optional(),
  // Optional: name the client here and the link is attributed to them. Leave
  // both blank and whoever opens the link is asked before they can shortlist.
  clientName: optionalString,
  clientPhone: z.preprocess(
    emptyToUndefined,
    z.string().trim().refine(isUsablePhone, "Enter a valid phone number").optional()
  ),
});

export type ShareLinkFormValues = z.infer<typeof shareLinkSchema>;
