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

export const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: "male", label: "Groom" },
  { value: "female", label: "Bride" },
];

export const ACCESS_LEVEL_OPTIONS: { value: string; label: string; description: string }[] = [
  {
    value: "photos_only",
    label: "Photos only",
    description: "Just the name and photo gallery — no other details.",
  },
  {
    value: "partial",
    label: "Basic details",
    description:
      "Name, birth details, height, job/business, native place and photos.",
  },
  {
    value: "full",
    label: "All details",
    description:
      "Everything the client can see. Finances, marital status and internal notes stay hidden.",
  },
];

/** Castes offered in the search filter, per the intake sheet. */
export const CASTE_OPTIONS = ["Reddy", "Kamma", "Velama"] as const;

/** Internal classification from the intake sheet. */
export const TAG_OPTIONS = ["AM", "AMP", "AMO"] as const;

export const ADMIN_SESSION_COOKIE = "aura_admin_session";

export const PROFILE_PHOTOS_BUCKET = "profile-photos";

export const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour, regenerated on each render

/** Cookie holding the signed id of the client currently browsing. */
export const CLIENT_SESSION_COOKIE = "aura_client_session";

/** Job categories offered in the profile form and the search filters. */
export const PROFESSION_CATEGORIES = [
  "Doctor",
  "Engineer",
  "Software Engineer",
  "Lawyer",
  "Business",
  "Start-up",
  "Govt / Civil service",
  "Political",
  "Others",
] as const;

/** Where the person currently lives. States are offered for India and the USA. */
export const COUNTRY_OPTIONS = ["India", "Europe", "Africa", "USA", "Australia"] as const;

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
] as const;

export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina",
  "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
  "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
  "District of Columbia",
] as const;

/** Only these two countries have a state list; the rest leave the field free. */
export const STATES_BY_COUNTRY: Record<string, readonly string[]> = {
  India: INDIAN_STATES,
  USA: US_STATES,
};

/** Marital status of a sibling, from the M / UM / D boxes on the intake form. */
export const SIBLING_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "married", label: "Married" },
  { value: "unmarried", label: "Unmarried" },
  { value: "divorced", label: "Divorced" },
];

/** The three consultants who keep their own follow-up notes. */
export const TEAM_MEMBERS = [
  { slug: "anupama", name: "Anupama" },
  { slug: "shaurya", name: "Shaurya" },
  { slug: "shreya", name: "Shreya" },
] as const;

export const JOURNEY_MEDIA_BUCKET = "journey-media";
