export const RELIGIONS = [
  "Hindu",
  "Muslim",
  "Christian",
  "Sikh",
  "Jain",
  "Buddhist",
  "Parsi",
  "Other",
] as const;

export const DIET_OPTIONS: { value: string; label: string }[] = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "eggetarian", label: "Eggetarian" },
  { value: "non_vegetarian", label: "Non-Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "jain", label: "Jain" },
];

export const MARITAL_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "never_married", label: "Never Married" },
  { value: "divorced", label: "Divorced" },
  { value: "widowed", label: "Widowed" },
  { value: "awaiting_divorce", label: "Awaiting Divorce" },
];

export const MANGLIK_OPTIONS: { value: string; label: string }[] = [
  { value: "yes", label: "Manglik" },
  { value: "no", label: "Not Manglik" },
  { value: "anshik", label: "Anshik Manglik" },
  { value: "unknown", label: "Unknown" },
];

export const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: "male", label: "Groom" },
  { value: "female", label: "Bride" },
];

export const ACCESS_LEVEL_OPTIONS: { value: string; label: string; description: string }[] = [
  {
    value: "partial",
    label: "Partial",
    description: "Basic info & photos only. Family, career and horoscope details stay hidden.",
  },
  {
    value: "full",
    label: "Full",
    description: "Everything except confidential admin notes and net worth.",
  },
];

export const DEFAULT_SHARE_EXPIRY_DAYS = 3;

export const ADMIN_SESSION_COOKIE = "aura_admin_session";

export const PROFILE_PHOTOS_BUCKET = "profile-photos";

export const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour, regenerated on each render
