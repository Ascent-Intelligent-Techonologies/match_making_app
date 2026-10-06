import { parseCsvRows } from "@/lib/import/csv";
import { INDIAN_STATES, PROFESSION_CATEGORIES } from "@/lib/constants";
import type { ProfileFormValues } from "@/lib/validation";

/**
 * Maps an export from the previous matrimony system onto our profile shape.
 *
 * The source carries things we have no field for, and several of its columns
 * are foreign keys into lookup tables we were not given (current_city "129820"
 * and friends), so the rule is: map what maps, keep what matters in the
 * private notes, and never invent. Everything dropped is counted and reported
 * back rather than discarded silently.
 */

/** Values the source uses to mean "nothing here". */
const EMPTY = new Set(["", "na", "n/a", "-", "none", "null", "[]"]);

function clean(value: string | undefined): string | undefined {
  const v = (value ?? "").trim();
  return EMPTY.has(v.toLowerCase()) ? undefined : v;
}

/** `5'11"` and `5'7.5"` both mean a height; halves round to the nearest inch. */
export function parseHeightToCm(raw: string | undefined): number | undefined {
  const v = clean(raw);
  if (!v) return undefined;
  const m = v.match(/^(\d+)\s*'\s*(\d+(?:\.\d+)?)?\s*"?$/);
  if (!m) return undefined;
  const feet = Number(m[1]);
  const inches = m[2] ? Number(m[2]) : 0;
  if (!Number.isFinite(feet) || feet < 3 || feet > 8) return undefined;
  return Math.round((feet * 12 + inches) * 2.54);
}

/** "16:05:00" reads as "4:05 PM", which is how the intake sheet writes it. */
export function formatBirthTime(raw: string | undefined): string | undefined {
  const v = clean(raw);
  if (!v) return undefined;
  const m = v.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return v;
  const h24 = Number(m[1]);
  if (!Number.isFinite(h24) || h24 > 23) return v;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

/** "1989-10-10" only; anything else is left out rather than guessed at. */
function parseDate(raw: string | undefined): string | undefined {
  const v = clean(raw);
  if (!v) return undefined;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

/** The source's country names, onto the five the form offers. */
const COUNTRY_MAP: Record<string, string> = {
  india: "India",
  "united states": "USA",
  usa: "USA",
  us: "USA",
  australia: "Australia",
  "united kingdom": "Europe",
  uk: "Europe",
  ireland: "Europe",
  germany: "Europe",
  france: "Europe",
  netherlands: "Europe",
  switzerland: "Europe",
  sweden: "Europe",
  spain: "Europe",
  italy: "Europe",
  "south africa": "Africa",
  nigeria: "Africa",
  kenya: "Africa",
};

const STATE_LOOKUP = new Map(INDIAN_STATES.map((s) => [s.toLowerCase(), s]));
const CATEGORY_LOOKUP = new Map(
  PROFESSION_CATEGORIES.map((c) => [c.toLowerCase(), c])
);

/**
 * `current_region` mixes cities, states and countries in one column, so it is
 * sorted into the right one here rather than dumped into a single field.
 */
function resolveLocation(row: Record<string, string>) {
  const region = clean(row.current_region);
  const sourceCountry = clean(row.country);

  let country = sourceCountry ? COUNTRY_MAP[sourceCountry.toLowerCase()] : undefined;
  let state: string | undefined;
  let city: string | undefined;

  if (region) {
    const asState = STATE_LOOKUP.get(region.toLowerCase());
    const asCountry = COUNTRY_MAP[region.toLowerCase()];
    if (asState) {
      state = asState;
      country ??= "India";
    } else if (asCountry) {
      country ??= asCountry;
    } else {
      city = region;
    }
  }

  return { country, state, city, unmappedCountry: sourceCountry && !country ? sourceCountry : undefined };
}

/** Joined with a separator, skipping the parts that are not there. */
function joinParts(parts: (string | undefined)[], sep = " · "): string | undefined {
  const kept = parts.filter((p): p is string => Boolean(p));
  return kept.length > 0 ? kept.join(sep) : undefined;
}

/** `["Reddy","Kamma"]` → `Reddy, Kamma`. Malformed JSON is simply skipped. */
function parseJsonList(raw: string | undefined): string[] {
  const v = clean(raw);
  if (!v) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed)
      ? parsed.map(String).map((s) => s.trim()).filter((s) => s && !/^\d+$/.test(s))
      : [];
  } catch {
    return [];
  }
}

export interface MappedRow {
  sourceId: string;
  values: ProfileFormValues & { source_id: string; deleted_at?: null };
  /** Why a row was not usable. Present means it is not imported. */
  error?: string;
}

export interface ImportSummary {
  totalRows: number;
  usable: number;
  skipped: { sourceId: string; reason: string }[];
  /** Counts of things the source had that we cannot store. */
  dropped: {
    photos: number;
    unmappedCountries: Record<string, number>;
    unmappedOccupations: Record<string, number>;
  };
  inactive: number;
}

const REQUIRED_HEADERS = ["id", "full_name", "gender", "date_of_birth"];

export function mapRow(row: Record<string, string>): MappedRow {
  const sourceId = clean(row.id) ?? "";
  const fullName = clean(row.full_name);

  if (!sourceId) {
    return { sourceId: "", values: null as never, error: "No id column value" };
  }
  if (!fullName) {
    return { sourceId, values: null as never, error: "No name" };
  }

  const genderRaw = (clean(row.gender) ?? "").toLowerCase();
  const gender =
    genderRaw === "male" ? "male" : genderRaw === "female" ? "female" : undefined;

  const { country, state, city } = resolveLocation(row);

  const occupation = clean(row.occupation);
  const professionCategory = occupation
    ? (CATEGORY_LOOKUP.get(occupation.toLowerCase()) ?? "Others")
    : undefined;

  const rejected = (clean(row.status) ?? "").toLowerCase() === "rejected";
  const maritalStatus = clean(row.marital_status);

  // Everything we cannot give a field to, but that an admin would want to see,
  // is kept verbatim here rather than thrown away on the way in.
  const notes = joinParts(
    [
      maritalStatus && maritalStatus.toLowerCase() !== "never married"
        ? `Marital status: ${maritalStatus}`
        : undefined,
      rejected
        ? `Rejected in the previous system${clean(row.rejected_reason) ? ` (${clean(row.rejected_reason)})` : ""}`
        : undefined,
      clean(row.visa_status) ? `Visa: ${clean(row.visa_status)}` : undefined,
      clean(row.complexion) ? `Complexion: ${clean(row.complexion)}` : undefined,
      clean(row.build) ? `Build: ${clean(row.build)}` : undefined,
      clean(row.permanent_address)
        ? `Permanent address: ${clean(row.permanent_address)}`
        : undefined,
      clean(row.admin_notes),
    ],
    "\n"
  );

  const preferred = parseJsonList(row.preferred_community);

  const values = {
    source_id: sourceId,
    full_name: fullName,
    gender,
    dob: parseDate(row.date_of_birth),
    birth_time: formatBirthTime(row.time_of_birth),
    birth_place: clean(row.city_of_birth),
    height_cm: parseHeightToCm(row.height),

    caste: clean(row.community),
    sub_caste: clean(row.sub_sect),
    gotram: clean(row.gothram),
    nakshatram: clean(row.star),
    rasi: clean(row.raasi),

    country,
    state,
    city,
    current_address: clean(row.current_address),
    citizenship: clean(row.visa_status),

    education_degree: joinParts([
      clean(row.ug_details) ? `UG: ${clean(row.ug_details)}` : undefined,
      clean(row.pg_details) ? `PG: ${clean(row.pg_details)}` : undefined,
      clean(row.super_speciality) ? `Super-speciality: ${clean(row.super_speciality)}` : undefined,
    ]),
    school: clean(row.school),

    profession_category: professionCategory,
    profession: clean(row.designation) ?? occupation,
    company: clean(row.work_place),
    salary: clean(row.salary),

    hobbies: (clean(row.hobbies) ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),

    partner_expectations:
      preferred.length > 0 ? `Prefers: ${preferred.join(", ")}` : undefined,

    net_worth_notes: joinParts([
      clean(row.family_property) ? `Family property: ${clean(row.family_property)}` : undefined,
      clean(row.property_share) ? `Share: ${clean(row.property_share)}` : undefined,
    ]),

    contact_phone: clean(row.phone_number),
    middlemen_contact_name: clean(row.referred_by) ?? clean(row.caller_name),
    owner_private_notes: notes,

    // A profile the previous system rejected comes in switched off, so it is
    // on the books without turning up in anyone's search.
    is_active: !rejected,
    tags: [],
  } as MappedRow["values"];

  return { sourceId, values };
}

export interface ParsedImport {
  rows: MappedRow[];
  summary: ImportSummary;
  /** Set when the file is not the expected export at all. */
  fatal?: string;
}

export function parseProfileCsv(text: string): ParsedImport {
  let records: Record<string, string>[];
  try {
    records = parseCsvRows(text);
  } catch {
    return { rows: [], summary: emptySummary(), fatal: "That file could not be read as CSV." };
  }

  if (records.length === 0) {
    return { rows: [], summary: emptySummary(), fatal: "The file has no rows." };
  }

  const headers = Object.keys(records[0]);
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return {
      rows: [],
      summary: emptySummary(),
      fatal: `This does not look like the profile export — missing column${
        missing.length === 1 ? "" : "s"
      }: ${missing.join(", ")}.`,
    };
  }

  const rows: MappedRow[] = [];
  const summary = emptySummary();
  summary.totalRows = records.length;

  const seen = new Set<string>();

  for (const record of records) {
    const mapped = mapRow(record);

    if (mapped.error) {
      summary.skipped.push({ sourceId: mapped.sourceId || "(no id)", reason: mapped.error });
      continue;
    }
    // The same id twice in one file would fight over the same row.
    if (seen.has(mapped.sourceId)) {
      summary.skipped.push({ sourceId: mapped.sourceId, reason: "Duplicate id in this file" });
      continue;
    }
    seen.add(mapped.sourceId);

    const photos = ["image_1", "image_2", "image_3", "image_4"].filter((k) =>
      clean(record[k])
    ).length;
    summary.dropped.photos += photos;

    const { unmappedCountry } = resolveLocation(record);
    if (unmappedCountry) {
      summary.dropped.unmappedCountries[unmappedCountry] =
        (summary.dropped.unmappedCountries[unmappedCountry] ?? 0) + 1;
    }

    const occupation = clean(record.occupation);
    if (occupation && !CATEGORY_LOOKUP.has(occupation.toLowerCase())) {
      summary.dropped.unmappedOccupations[occupation] =
        (summary.dropped.unmappedOccupations[occupation] ?? 0) + 1;
    }

    if (!mapped.values.is_active) summary.inactive++;
    rows.push(mapped);
  }

  summary.usable = rows.length;
  return { rows, summary };
}

function emptySummary(): ImportSummary {
  return {
    totalRows: 0,
    usable: 0,
    skipped: [],
    dropped: { photos: 0, unmappedCountries: {}, unmappedOccupations: {} },
    inactive: 0,
  };
}
