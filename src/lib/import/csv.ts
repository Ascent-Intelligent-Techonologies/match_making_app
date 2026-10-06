/**
 * A small RFC 4180 CSV reader.
 *
 * Written rather than pulled in, because the whole job is one function and the
 * awkward parts are few: quoted fields may contain commas, newlines and
 * doubled quotes, and files arrive with either line ending and sometimes a
 * byte-order mark. Exported rows are keyed by the header.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // A BOM would otherwise become part of the first header's name.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < input.length; i++) {
    const c = input[i];

    if (inQuotes) {
      if (c === '"') {
        // A doubled quote inside a quoted field is one literal quote.
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      // Swallow the \n of a \r\n pair so it does not start an empty row.
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  // A file that does not end in a newline still has a last row to flush.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Trailing blank lines are not rows.
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

/** Rows as objects keyed by the header, with every value trimmed. */
export function parseCsvRows(text: string): Record<string, string>[] {
  const [header, ...body] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((cells) =>
    Object.fromEntries(keys.map((k, i) => [k, (cells[i] ?? "").trim()]))
  );
}
