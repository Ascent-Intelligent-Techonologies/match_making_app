/**
 * Normalises a phone number down to the digits we use as a client's identity.
 *
 * Numbers get typed inconsistently ("+91 98765 43210", "09876543210",
 * "9876543210"), so we strip everything non-numeric and keep the last 10
 * digits. That collapses country code and leading-zero variants onto the same
 * client, which is what we want for an India-focused book of clients.
 */
export function normalizePhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** True when a phone number has enough digits to identify someone. */
export function isUsablePhone(raw: string): boolean {
  return normalizePhone(raw).length >= 10;
}

export interface PhoneRegion {
  id: string;
  label: string;
  /** null where one region spans many calling codes: the visitor types theirs. */
  code: string | null;
  /** Digits wanted after the code, trunk zero not counted. */
  minDigits: number;
  placeholder: string;
}

/** Where the families we serve are most likely to be dialling from. */
export const PHONE_REGIONS: PhoneRegion[] = [
  { id: "in", label: "+91 India", code: "+91", minDigits: 10, placeholder: "98765 43210" },
  { id: "us", label: "+1 USA/Canada", code: "+1", minDigits: 10, placeholder: "415 555 0132" },
  { id: "eu", label: "Europe", code: null, minDigits: 0, placeholder: "+44 7911 123456" },
  { id: "af", label: "Africa", code: null, minDigits: 0, placeholder: "+27 82 123 4567" },
  { id: "au", label: "+61 Australia", code: "+61", minDigits: 9, placeholder: "412 345 678" },
];

export const DEFAULT_PHONE_REGION = PHONE_REGIONS[0];

/**
 * The region's code and what was typed, as one string for the server.
 *
 * Europe and Africa each cover many calling codes, so for those the number is
 * typed in full, starting with "+". A number that starts with "+" is taken as
 * complete in every region, so pasting "+91 98765 43210" does not come out
 * doubled; otherwise a leading trunk zero ("098765 43210") is dropped.
 */
export function joinPhone(region: PhoneRegion, typed: string): string {
  const number = typed.trim();
  if (!number) return "";
  if (number.startsWith("+") || !region.code) return number;
  return `${region.code} ${number.replace(/^0+/, "")}`;
}

/**
 * Why a half-typed number is not enough yet, or null. Counted without the
 * code: the server's ten-digit check also counts the code's own digits, so on
 * its own it would let an eight-digit Indian number through.
 */
export function phoneProblem(region: PhoneRegion, typed: string): string | null {
  const number = typed.trim();
  if (!number) return null; // `required` already covers empty
  const digits = number.replace(/\D/g, "");

  if (number.startsWith("+")) {
    return digits.length >= 10 ? null : "Enter the full number, including its + code.";
  }
  if (!region.code) return "Start with your country code, for example +44.";
  return digits.replace(/^0+/, "").length >= region.minDigits
    ? null
    : `Enter the ${region.minDigits}-digit mobile number.`;
}
