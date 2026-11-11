import { feetInchesToCm } from "@/lib/format";

/**
 * The profile form's fields as the schemas expect them. Shared by the admin
 * actions and the public self-onboarding action, which each validate the
 * result against their own schema. Lives outside the "use server" files
 * because those may only export async functions.
 */
export function parseProfileFormData(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const hobbies = String(raw.hobbies ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  // The form collects height as feet + inches; cm is what we store.
  // Multi-value fields are lost by Object.fromEntries, which keeps only the
  // last value, so each one is read with getAll instead.
  const tags = formData.getAll("tags").map(String).filter(Boolean);

  const { height_feet, height_inches, ...rest } = raw;
  const heightCm = feetInchesToCm(Number(height_feet), Number(height_inches));

  return {
    ...rest,
    hobbies,
    tags,
    height_cm: heightCm,
    // Unchecked boxes post nothing at all, so each one is read explicitly
    // rather than inferred from the spread above.
    is_active: formData.get("is_active") === "on",
    urgent: formData.get("urgent") === "on",
    sibling1_potential_client: formData.get("sibling1_potential_client") === "on",
    sibling2_potential_client: formData.get("sibling2_potential_client") === "on",
    anurupa_aura: formData.get("anurupa_aura") === "on",
  };
}
