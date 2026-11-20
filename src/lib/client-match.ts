import { calculateAge } from "@/lib/format";

/**
 * Client match: a boy's and a girl's profile whose families are in
 * communication. Shared by the server (which finds and saves them) and the
 * pickers and table (which show them), so it holds no database code.
 */

/** A profile as offered in a picker, and as shown on a row. */
export interface MatchProfile {
  id: string;
  full_name: string;
  surname: string | null;
  dob: string | null;
  city: string | null;
  /** Null when the profile has none: the sign-up form leaves it optional. */
  gender: "male" | "female" | null;
}

export type MatchSide = "boy" | "girl";

/** The database value for each side of a pair. */
export const GENDER_FOR_SIDE: Record<MatchSide, "male" | "female"> = {
  boy: "male",
  girl: "female",
};

export const MAX_MATCH_NOTES_LENGTH = 2000;

export const fullName = (p: Pick<MatchProfile, "full_name" | "surname">) =>
  [p.full_name, p.surname].filter(Boolean).join(" ");

/** "29 yrs · Hyderabad", whatever of it is known. */
export function describeProfile(p: Pick<MatchProfile, "dob" | "city">): string {
  const age = calculateAge(p.dob);
  return [age ? `${age} yrs` : null, p.city].filter(Boolean).join(" · ");
}
