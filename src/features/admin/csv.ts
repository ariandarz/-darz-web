/**
 * A small RFC-4180 CSV reader for the Import desk. The old desk parsed
 * Airtable exports client-side ("mapped by column", `importView`,
 * `darz-studio.html:29710`) and the backend deliberately keeps parsing on the
 * client — it stages already-structured rows (its Phase 23 note: "the client
 * parses and POSTs structured rows").
 *
 * Hand-rolled rather than a dependency because the need is exactly RFC 4180:
 * quoted fields, embedded commas/quotes/newlines, CRLF. Anything beyond that
 * (encodings, sniffing) is out of scope on purpose. Pure and tested.
 */

/** Parse CSV text into rows of cells. Handles quotes, "" escapes, embedded
 * newlines and CRLF. A trailing newline does not produce a phantom row. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/**
 * Header row → the artwork-field each column lands in. Exact (case/space
 * insensitive) matches on the serializer's own field names plus the obvious
 * export spellings; an unmatched column maps to '' (ignored) until the person
 * assigns it. The TARGETS list is `ArtworkAdminSerializer`'s writable fields —
 * `artist_name_raw` is what lets a CSV carry the artist as text with no uuid.
 */
export const CSV_TARGETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: '— ignore —' },
  { value: 'title', label: 'Title' },
  { value: 'artist_name_raw', label: 'Artist (name)' },
  { value: 'year', label: 'Year' },
  { value: 'medium', label: 'Medium' },
  { value: 'material', label: 'Material' },
  { value: 'dimensions', label: 'Dimensions' },
  { value: 'edition', label: 'Edition' },
  { value: 'city', label: 'City' },
  { value: 'price_amount', label: 'Price amount' },
  { value: 'currency', label: 'Currency' },
  { value: 'price_type', label: 'Price type' },
  { value: 'source_name', label: 'Source' },
  { value: 'public_description', label: 'Public description' },
  { value: 'internal_notes', label: 'Internal notes' },
  { value: 'provenance', label: 'Provenance' },
  { value: 'legacy_airtable_id', label: 'Airtable id' },
];

const AUTO: Record<string, string> = {
  title: 'title',
  artwork: 'title',
  name: 'title',
  artist: 'artist_name_raw',
  artist_name: 'artist_name_raw',
  artist_name_raw: 'artist_name_raw',
  year: 'year',
  date: 'year',
  medium: 'medium',
  material: 'material',
  materials: 'material',
  dimensions: 'dimensions',
  size: 'dimensions',
  edition: 'edition',
  city: 'city',
  price: 'price_amount',
  price_amount: 'price_amount',
  amount: 'price_amount',
  currency: 'currency',
  price_type: 'price_type',
  source: 'source_name',
  source_name: 'source_name',
  description: 'public_description',
  public_description: 'public_description',
  notes: 'internal_notes',
  internal_notes: 'internal_notes',
  provenance: 'provenance',
  airtable_id: 'legacy_airtable_id',
  legacy_airtable_id: 'legacy_airtable_id',
};

export function guessMapping(headers: string[]): string[] {
  return headers.map(
    (h) =>
      AUTO[
        h
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, '_')
      ] ?? '',
  );
}

/** Apply a column→field mapping to data rows. Blank targets and blank cells
 * are dropped; a duplicate target keeps the LAST non-empty cell (a mapping
 * mistake should be visible in review, not silently doubled into one field). */
export function rowsToRecords(
  rows: string[][],
  mapping: string[],
): Array<Record<string, string>> {
  return rows
    .map((cells) => {
      const record: Record<string, string> = {};
      mapping.forEach((target, i) => {
        const value = (cells[i] ?? '').trim();
        if (target && value) record[target] = value;
      });
      return record;
    })
    .filter((r) => Object.keys(r).length > 0);
}
