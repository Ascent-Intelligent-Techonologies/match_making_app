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
