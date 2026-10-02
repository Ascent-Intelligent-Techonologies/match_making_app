import type { ThemeColors } from "@/lib/theme";

export type Gender = "male" | "female";

export type MaritalStatus =
  | "never_married"
  | "divorced"
  | "widowed"
  | "awaiting_divorce";

export type Manglik = "yes" | "no" | "anshik" | "unknown";

export type Diet =
  | "vegetarian"
  | "eggetarian"
  | "non_vegetarian"
  | "vegan"
  | "jain";

export type AccessLevel = "photos_only" | "partial" | "full";

export interface ProfilePhoto {
  id: string;
  profile_id: string;
  storage_path: string;
  sort_order: number;
  is_cover: boolean;
  created_at: string;
  /** Populated at render time, never stored. */
  signedUrl?: string;
}

export interface Profile {
  id: string;
  created_at: string;
  updated_at: string;

  full_name: string;
  gender: Gender | null;
  dob: string | null;
  height_cm: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  marital_status: MaritalStatus | null;
  religion: string | null;
  caste: string | null;
  mother_tongue: string | null;

  education_degree: string | null;
  institution: string | null;
  profession: string | null;
  company: string | null;
  annual_income_inr: number | null;

  father_profession: string | null;
  mother_profession: string | null;
  siblings_count: number | null;
  family_status_notes: string | null;

  birth_time: string | null;
  birth_place: string | null;
  star_sign: string | null;
  manglik: Manglik | null;
  horoscope_notes: string | null;

  hobbies: string[] | null;
  diet: Diet | null;
  partner_expectations: string | null;

  net_worth_notes: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  owner_private_notes: string | null;

  // --- intake-form fields (see supabase/migrations/002_*.sql) ---
  surname: string | null;
  rasi: string | null;
  nakshatram: string | null;
  gotram: string | null;
  sub_caste: string | null;
  native_place: string | null;
  school: string | null;
  business: string | null;
  salary: string | null;
  citizenship: string | null;
  father_name: string | null;
  father_native_place: string | null;
  mother_name: string | null;
  mother_native_place: string | null;
  siblings_name: string | null;
  siblings_details: string | null;
  current_address: string | null;
  middlemen_contact: string | null;
  /** Internal classification from the intake sheet (AM / AMP / AMO). */
  tag: string | null;

  is_active: boolean;
}

export interface ProfileWithPhotos extends Profile {
  photos: ProfilePhoto[];
}

export interface ShareLink {
  id: string;
  token: string;
  label: string | null;
  access_level: AccessLevel;
  expires_at: string;
  revoked: boolean;
  created_at: string;
  client_id: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
}

/** A person we are shortlisting for, identified by phone number. */
export interface Client {
  id: string;
  created_at: string;
  updated_at: string;
  full_name: string;
  /** Normalised digits used as the identity key. */
  phone: string;
  /** Exactly what the admin typed. */
  phone_display: string | null;
  notes: string | null;
  last_activity_at: string | null;
}

/** A client plus the engagement counts shown in admin lists. */
export interface ClientSummary extends Client {
  sharedProfileCount: number;
  shortlistedCount: number;
  linkCount: number;
  lastSharedAt: string | null;
}

export interface ClientShortlist {
  id: string;
  client_id: string;
  profile_id: string;
  share_link_id: string | null;
  created_at: string;
}

export interface ShareLinkWithProfiles extends ShareLink {
  profiles: Pick<Profile, "id" | "full_name" | "city">[];
  client: Pick<Client, "id" | "full_name" | "phone_display"> | null;
}

export interface AppSettings {
  id: number;
  default_expiry_days: number;
  /** Palette saved from Admin -> Settings; null means use the app defaults. */
  theme_colors?: ThemeColors | null;
}

/** Shared when access_level is "photos_only" — the gallery and nothing else. */
// Name is kept so the client can refer to a profile when they shortlist it.
export const PHOTOS_ONLY_FIELDS = ["full_name", "photos"] as const;

/**
 * Shared at "partial" — mirrors the basic-details tab of the intake sheet:
 * name (no surname), birth details, height, photos, job/business and native place.
 */
export const PARTIAL_VISIBLE_FIELDS = [
  "full_name",
  "dob",
  "birth_place",
  "birth_time",
  "height_cm",
  "profession",
  "business",
  "native_place",
  "photos",
] as const;

/**
 * Added at "full" — the all-details tab of the intake sheet. Marital status,
 * finances and tag are deliberately absent: the sheet keeps those internal.
 */
export const FULL_ONLY_FIELDS = [
  "surname",
  "gender",
  "city",
  "state",
  "country",
  "religion",
  "caste",
  "sub_caste",
  "mother_tongue",
  "rasi",
  "nakshatram",
  "gotram",
  "star_sign",
  "education_degree",
  "institution",
  "school",
  "citizenship",
  "company",
  "salary",
  "father_name",
  "father_profession",
  "father_native_place",
  "mother_name",
  "mother_profession",
  "mother_native_place",
  "siblings_count",
  "siblings_name",
  "siblings_details",
  "family_status_notes",
  "current_address",
  "hobbies",
  "partner_expectations",
  "contact_phone",
  "contact_email",
] as const;

/** Never exposed to clients, whatever the access level. */
export const ADMIN_ONLY_FIELDS = [
  "net_worth_notes",
  "owner_private_notes",
  "middlemen_contact",
  "marital_status",
  "annual_income_inr",
  "tag",
] as const;

export type PublicProfile = Partial<Profile> &
  Pick<Profile, "id" | "full_name"> & { photos: ProfilePhoto[] };

export function toPublicProfile(
  profile: ProfileWithPhotos,
  accessLevel: AccessLevel
): PublicProfile {
  const visibleKeys = new Set<string>(
    accessLevel === "photos_only"
      ? PHOTOS_ONLY_FIELDS
      : [
          ...PARTIAL_VISIBLE_FIELDS,
          ...(accessLevel === "full" ? FULL_ONLY_FIELDS : []),
        ]
  );

  const result: Record<string, unknown> = { id: profile.id, photos: profile.photos };
  for (const key of Object.keys(profile) as (keyof ProfileWithPhotos)[]) {
    if (visibleKeys.has(key)) {
      result[key] = profile[key];
    }
  }
  return result as PublicProfile;
}
