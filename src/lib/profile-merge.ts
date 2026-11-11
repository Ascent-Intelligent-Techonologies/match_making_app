import { GENDER_OPTIONS } from "@/lib/constants";
import { formatDate, formatHeight } from "@/lib/format";
import { selfOnboardingSchema } from "@/lib/validation";

/**
 * Comparing a new sign-up with a profile already on the books, field by field.
 *
 * Pure (no database, no server-only code), so the review screen, the approve
 * action and the tests all use the same rules. The fields are exactly those
 * the public form collects, bar the phone number: that is what the two records
 * were matched on, so it cannot conflict. Nothing internal is in here, which
 * is also what keeps a merge from ever touching tags, notes or finances.
 */

const LABELS = {
  full_name: "Name",
  surname: "Surname",
  gender: "Gender",
  dob: "Date of birth",
  birth_time: "Time of birth",
  birth_place: "Place of birth",
  height_cm: "Height",
  native_place: "Native place",
  caste: "Caste",
  sub_caste: "Sub-caste",
  gotram: "Gotram",
  nakshatram: "Nakshatram",
  rasi: "Rasi",
  star_sign: "Star sign",
  religion: "Religion",
  mother_tongue: "Mother tongue",
  country: "Country",
  state: "State",
  city: "City",
  education_degree: "Degree",
  institution: "University",
  school: "School",
  profession_category: "Job category",
  profession: "Job",
  business: "Business",
  company: "Company",
  salary: "Salary",
  citizenship: "Citizenship",
  father_name: "Father",
  father_profession: "Father's occupation",
  father_native_place: "Father's native place",
  mother_name: "Mother",
  mother_profession: "Mother's occupation",
  mother_native_place: "Mother's native place",
  sibling1_name: "Sibling 1",
  sibling1_status: "Sibling 1 marital status",
  sibling1_details: "Sibling 1 details",
  sibling2_name: "Sibling 2",
  sibling2_status: "Sibling 2 marital status",
  sibling2_details: "Sibling 2 details",
  current_address: "Current address",
  family_status_notes: "Family background",
  hobbies: "Hobbies",
  partner_expectations: "Requirements",
  primary_contact_name: "Primary contact name",
  primary_contact_relation: "Primary contact relation",
  contact_email: "Email",
} as const satisfies Record<string, string>;

export type MergeFieldKey = keyof typeof LABELS;

/** In the order the review screen lists them. */
export const MERGE_FIELD_KEYS = Object.keys(LABELS) as MergeFieldKey[];

/**
 * Fields whose value has a shape of its own (a date, a number, a pick from a
 * list). The admin chooses between the two values for these; typing a third in
 * a plain box would invite a value the field cannot hold.
 */
const CHOOSE_ONLY = new Set<string>(["gender", "dob", "height_cm", "hobbies"]);

/** A profile row, or anything shaped like one. */
type Row = object;

const field = (row: Row, key: string): unknown => (row as Record<string, unknown>)[key];

/** One field where the new sign-up has something to say. */
export interface FieldDiff {
  key: MergeFieldKey;
  label: string;
  /** "fill": the profile has nothing here, so the new answer is simply added. */
  kind: "conflict" | "fill";
  /** As it would be read on screen; null when the profile has nothing. */
  existing: string | null;
  incoming: string;
  /** Whether the admin may type their own answer instead of choosing one. */
  custom: boolean;
}

/** How the admin settled one conflicting field. */
export type FieldChoice =
  | { use: "existing" }
  | { use: "incoming" }
  | { use: "custom"; value: string };

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Two answers that differ only in spacing or case are the same answer. */
function comparable(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((v) => comparable(v))
      .sort()
      .join("|");
  }
  return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

/** A value as the admin reads it. */
export function displayValue(key: string, value: unknown): string {
  if (isEmpty(value)) return "";
  switch (key) {
    case "gender":
      return GENDER_OPTIONS.find((o) => o.value === value)?.label ?? String(value);
    case "dob":
      return formatDate(String(value));
    case "height_cm":
      return formatHeight(Number(value));
    case "hobbies":
      return (value as string[]).join(", ");
    default:
      return String(value);
  }
}

/**
 * What the new sign-up would change on the existing profile.
 *
 * A field the sign-up left blank is not listed: a blank answer never erases
 * what the profile already has. A field the profile has nothing for is a
 * "fill". Only where both have an answer, and the answers really differ, is it
 * a "conflict" the admin has to settle.
 */
export function diffProfiles(existing: Row, incoming: Row): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  for (const key of MERGE_FIELD_KEYS) {
    const theirs = field(incoming, key);
    if (isEmpty(theirs)) continue;

    const ours = field(existing, key);
    const base = {
      key,
      label: LABELS[key],
      incoming: displayValue(key, theirs),
      custom: !CHOOSE_ONLY.has(key),
    };

    if (isEmpty(ours)) {
      diffs.push({ ...base, kind: "fill", existing: null });
    } else if (comparable(ours) !== comparable(theirs)) {
      diffs.push({ ...base, kind: "conflict", existing: displayValue(key, ours) });
    }
  }

  return diffs;
}

export type MergeResolution = { changes: Record<string, unknown> } | { error: string };

/**
 * The columns to write on the existing profile, given the admin's answers.
 *
 * Every fill is applied; every conflict must have an answer, and "keep what is
 * there" is an answer that changes nothing. A typed answer is checked by the
 * same rules as the public form, so it cannot put anything on the profile the
 * form itself would have refused.
 */
export function resolveMerge(
  existing: Row,
  incoming: Row,
  choices: Record<string, FieldChoice | undefined>
): MergeResolution {
  const changes: Record<string, unknown> = {};

  for (const diff of diffProfiles(existing, incoming)) {
    if (diff.kind === "fill") {
      changes[diff.key] = field(incoming, diff.key);
      continue;
    }

    const choice = choices[diff.key];
    if (!choice) return { error: `Please choose an answer for ${diff.label}.` };

    if (choice.use === "incoming") {
      changes[diff.key] = field(incoming, diff.key);
    } else if (choice.use === "custom") {
      if (!diff.custom) return { error: `${diff.label}: choose one of the two answers.` };
      const typed = typeof choice.value === "string" ? choice.value.trim() : "";
      if (typed === "") return { error: `Type an answer for ${diff.label}, or choose one.` };
      if (typed.length > 2000) return { error: `${diff.label} is too long.` };
      const parsed = selfOnboardingSchema.shape[diff.key].safeParse(typed);
      if (!parsed.success || parsed.data === undefined) {
        return { error: `${diff.label}: that is not a valid answer.` };
      }
      changes[diff.key] = parsed.data;
    } else if (choice.use !== "existing") {
      return { error: `Please choose an answer for ${diff.label}.` };
    }
  }

  return { changes };
}

/** The name a client ends up with when a sign-up is linked to them. */
export type ClientNameChoice =
  | { use: "client" }
  | { use: "profile" }
  | { use: "custom"; value: string };

/** The name for a client who is being linked to the sign-up, or why it cannot be set. */
export function resolveClientName(
  choice: ClientNameChoice | undefined,
  clientName: string,
  submittedName: string
): { name: string } | { error: string } {
  if (!choice || choice.use === "client") return { name: clientName };
  if (choice.use === "profile") return { name: submittedName };
  if (choice.use === "custom") {
    const typed = typeof choice.value === "string" ? choice.value.trim() : "";
    if (typed === "") return { error: "Type the client's name, or choose one." };
    if (typed.length > 200) return { error: "That name is too long." };
    return { name: typed };
  }
  return { error: "Please choose the client's name." };
}

/**
 * What the admin decided when approving a sign-up whose number is already on
 * the books. "merge" folds the sign-up into one of the matched profiles, with
 * an answer for every conflicting field; "separate" approves it as a profile
 * of its own, and, when the number belongs to a standalone client, may link
 * that client to it instead of leaving them as two.
 */
export type ApprovalDecision =
  | { mode: "separate"; linkClient?: ClientNameChoice }
  | { mode: "merge"; targetId: string; fields: Record<string, FieldChoice> };

// ------------------------------------------------- what the review screen gets --

/** An existing client holding the number, as the review screen shows them. */
export interface MatchedClient {
  id: string;
  name: string;
  /** Has work history worth keeping: shared links or shortlists. */
  summary: string;
  /**
   * Not the client of any profile: made some other way (someone who browsed
   * with this number, a share link), so there is no profile to merge into.
   * The sign-up can still be linked to them.
   */
  standalone: boolean;
}

/** An existing profile with the number, and what the sign-up would change on it. */
export interface MatchedProfile {
  id: string;
  name: string;
  /** What the sign-up would add or change on it, field by field. */
  diffs: FieldDiff[];
}

export interface ResolverData {
  /** The sign-up being approved. */
  profileId: string;
  /** "Name Surname" as submitted: what a linked client would be renamed to. */
  submittedName: string;
  client: MatchedClient | null;
  profiles: MatchedProfile[];
}
