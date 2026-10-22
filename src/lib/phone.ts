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

/** Shown in front of every number typed into the browse form. */
export const COUNTRY_CODE = "+91";

/**
 * The prefix and what was typed, as one string for the server.
 *
 * A number that already starts with "+" is taken as complete, so pasting
 * "+91 98765 43210" does not come out doubled, and a leading trunk zero
 * ("098765 43210") is dropped.
 */
export function joinPhone(typed: string): string {
  const number = typed.trim();
  if (!number) return "";
  if (number.startsWith("+")) return number;
  return `${COUNTRY_CODE} ${number.replace(/^0+/, "")}`;
}

/**
 * Why a half-typed number is not enough yet, or null. Counted without the
 * prefix: the server's ten-digit check also counts the code's two digits, so
 * on its own it would let an eight-digit number through.
 */
export function phoneProblem(typed: string): string | null {
  const number = typed.trim();
  if (!number) return null; // `required` already covers empty
  const digits = number.replace(/\D/g, "");

  if (number.startsWith("+")) {
    return digits.length >= 10 ? null : "Enter the full number, including its + code.";
  }
  return digits.replace(/^0+/, "").length >= 10 ? null : "Enter the 10-digit mobile number.";
}
