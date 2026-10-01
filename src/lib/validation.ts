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
  marital_status: z
    .enum(["never_married", "divorced", "widowed", "awaiting_divorce"])
    .optional(),
  religion: optionalString,
  caste: optionalString,
  mother_tongue: optionalString,

  education_degree: optionalString,
  institution: optionalString,
  profession: optionalString,
  company: optionalString,
  annual_income_inr: optionalNumber,

  father_profession: optionalString,
  mother_profession: optionalString,
  siblings_count: optionalNumber,
  family_status_notes: optionalString,

  birth_time: optionalString,
  birth_place: optionalString,
  star_sign: optionalString,
  manglik: z.enum(["yes", "no", "anshik", "unknown"]).optional(),
  horoscope_notes: optionalString,

  hobbies: z.array(z.string()).optional(),
  diet: z
    .enum(["vegetarian", "eggetarian", "non_vegetarian", "vegan", "jain"])
    .optional(),
  partner_expectations: optionalString,

  net_worth_notes: optionalString,
  contact_phone: optionalString,
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
  accessLevel: z.enum(["partial", "full"]),
  expiryDays: z.coerce.number().int().min(1).max(90),
  label: z.string().trim().optional(),
  // Every link is shared on behalf of someone, so we can track who saw what.
  clientName: z.string().trim().min(1, "Enter the client's name"),
  clientPhone: z
    .string()
    .trim()
    .refine(isUsablePhone, "Enter a valid phone number (at least 10 digits)"),
});

export type ShareLinkFormValues = z.infer<typeof shareLinkSchema>;
