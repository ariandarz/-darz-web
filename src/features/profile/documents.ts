/**
 * "Your documents" — the logic under the Profile › Account section, framework-
 * free so the node test project covers it.
 *
 * ## "New" is per device, as it was
 *
 * The old app marks a document "New" until it is opened **on this device**:
 * `dzDocSeen` / `dzDocIsNew` / `dzDocMarkSeen` (app.html:7888-7891) keep the
 * opened ids in `localStorage.darz_docs_seen`, capped at the last 400. The
 * backend's `shared_at` says when Darz shared a document, not whether the
 * collector has looked at it, so it cannot stand in for "unseen" — the same
 * key, the same cap, and the same "every storage call wrapped" discipline are
 * ported instead. A private window that refuses storage simply shows every
 * document as New, which is also what the old app did.
 *
 * ## The row label
 *
 * The old row's label is `DarzDocs.TYPES[type].short` (`darz_docs.js:48-50`:
 * Invoice · Certificate · Bill of Sale), falling back to `'Document'`
 * (app.html:7915). The backend's `kind` is freeform, with a collector-visible
 * allow-list (`invoice · certificate · provenance · contract · receipt ·
 * proforma · artwork_sheet · condition_report`). The three old types map onto
 * the three kinds that are the same document — `bos` is "Bill of Sale &
 * Provenance", so `provenance` reads "Bill of Sale" — and every other kind
 * takes the old fallback, "Document". No new label is invented; the document's
 * own `title` carries the specifics on the sub-line.
 */
import type { CollectorDocument } from '../../api/types';

export const SEEN_KEY = 'darz_docs_seen';
const SEEN_CAP = 400;

/** `DarzDocs.TYPES[…].short`, keyed by the backend kind it corresponds to. */
const SHORT: Record<string, string> = {
  invoice: 'Invoice',
  certificate: 'Certificate',
  provenance: 'Bill of Sale',
};

/** `dzDocSeen` — the opened ids, or `[]` for anything unreadable. */
export function readSeen(storage: Storage | null): string[] {
  try {
    const raw = storage?.getItem(SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

/** `dzDocMarkSeen` — append once, keep the newest 400. Returns the new set so
 * the caller can re-render without a second read. */
export function markSeen(storage: Storage | null, id: string): string[] {
  const seen = readSeen(storage);
  if (seen.includes(id)) return seen;
  const next = [...seen, id].slice(-SEEN_CAP);
  try {
    storage?.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    // storage full or refused — the badge just stays until the next visit
  }
  return next;
}

export function docLabel(kind: string): string {
  return SHORT[kind] ?? 'Document';
}

/** The row's sub-line: `<title> · <day month>` (app.html:7916-7917, where
 * the old `artist — title` pair is this backend's single `title`), dated by
 * when Darz shared it. */
export function docSub(doc: CollectorDocument): string {
  const title = doc.title.trim() || '—';
  const when = shortDate(doc.shared_at ?? doc.created_at);
  return when ? `${title} · ${when}` : title;
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** The browser's `localStorage`, or `null` where touching it throws. */
export function deviceStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
