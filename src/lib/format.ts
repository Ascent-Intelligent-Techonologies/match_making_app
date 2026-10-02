/** Formats an amount in INR using compact Indian numbering (e.g. ₹1.2 Cr, ₹45 L). */
export function formatInrCompact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function calculateAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/** Heights are entered and shown in feet and inches; cm is only the storage unit. */
export function cmToFeetInches(
  heightCm: number | null | undefined
): { feet: number; inches: number } | null {
  if (!heightCm) return null;
  const total = Math.round(heightCm / 2.54);
  // 11.5" rounds to 12", which should read as the next foot.
  return { feet: Math.floor(total / 12), inches: total % 12 };
}

export function feetInchesToCm(
  feet: number | null | undefined,
  inches: number | null | undefined
): number | undefined {
  const f = Number(feet) || 0;
  const i = Number(inches) || 0;
  if (f === 0 && i === 0) return undefined;
  return Math.round((f * 12 + i) * 2.54);
}

export function formatHeight(heightCm: number | null | undefined): string {
  const h = cmToFeetInches(heightCm);
  return h ? `${h.feet}'${h.inches}"` : "—";
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Human-friendly "how long ago", used in client activity columns. */
export function formatRelativeDays(value: string | null | undefined): string {
  if (!value) return "Never";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "Never";

  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 60) return "Last month";
  return `${Math.floor(days / 30)} months ago`;
}
