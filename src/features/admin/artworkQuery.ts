/**
 * The Artworks Database's pure halves (V1 Phase 4): how the old desk's filter
 * controls map onto `ArtworkAdminFilterSet`'s query params, how a tile's link
 * opens the desk pre-filtered, and how the publish gate's refusal reads.
 * Kept out of the page so each mapping is unit-tested (`artworkQuery.test.ts`).
 */
import { ValidationError } from '../../api/errors';
import type { ArtworkAdminQuery } from '../../api/types';

/* ── The old "More filters" selects (`darz-studio.html:26668-26684`) ─────── */

/**
 * The old **Images** select (`:26682`) was ONE control with three picks —
 * with images · without images · "Duplicates (same image)" (v607). The API
 * splits them over two params (`has_images`, `duplicate_images`), so the
 * select's value is derived from, and written back to, both.
 */
export type ImagesPick = 'yes' | 'no' | 'dup';

export function imagesPick(q: ArtworkAdminQuery): ImagesPick | undefined {
  if (q.duplicate_images === true) return 'dup';
  if (q.has_images === true) return 'yes';
  if (q.has_images === false) return 'no';
  return undefined;
}

export function imagesPatch(pick: string | undefined): Partial<ArtworkAdminQuery> {
  return {
    has_images: pick === 'yes' ? true : pick === 'no' ? false : undefined,
    duplicate_images: pick === 'dup' ? true : undefined,
  };
}

/** The old Images select's options and chip words (`:26682`, `:26712`). */
export const IMAGES_CHOICES = [
  { value: 'yes', label: 'With images' },
  { value: 'no', label: 'Without images' },
  { value: 'dup', label: 'Duplicates (same image)' },
];

/**
 * The old **Gallery Portal** select (`:26678`, v1166): "Gallery Portal: all"
 * · "In any portal" · "Not in a portal", then one entry per portal. The
 * backend answers the first two as a boolean on `visibility = gallery_portal`
 * (`GalleryPortalFilter`); the per-portal entries have no server filter and
 * are not offered (flagged in the page header).
 */
export const PORTAL_CHOICES = [
  { value: 'true', label: 'In any portal' },
  { value: 'false', label: 'Not in a portal' },
];

/**
 * The old **Details** (completeness) select (`:26683`, v607). Of its five
 * picks only "Missing required fields" has a server filter — `complete=false`,
 * the Data Health report's own definition. "Without size / price / source" and
 * "Missing any detail" are single-field checks the API does not filter on;
 * they are not offered (flagged in the page header).
 */
export const DETAILS_CHOICES = [{ value: 'false', label: 'Missing required fields' }];

/**
 * The old **Size** select (`:26685`, v937). The buckets are the BACKEND's
 * (owner decision 2026-09-24, `SizeRangeFilter`: largest side ≤ 50 · 50–120 ·
 * > 120 cm), not the old ≤ 40 · 40–100 · 100–200 · > 200 — so the labels keep
 * the old "Size: Small · ≤ N cm" shape with the server's numbers, because a
 * label promising 40 cm over a filter at 50 would lie. "Oversized", "Bigger /
 * Smaller than…" and the custom W×H range have no server filter.
 */
export const SIZE_CHOICES: ReadonlyArray<{
  value: 'small' | 'medium' | 'large';
  label: string;
}> = [
  { value: 'small', label: 'Size: Small · ≤ 50 cm' },
  { value: 'medium', label: 'Size: Medium · 50–120 cm' },
  { value: 'large', label: 'Size: Large · > 120 cm' },
];

/** The chip words for a size (the old chip drops "Size: " from the option,
 * `:26714`, and prefixes it again). */
export function sizeChip(size: string): string {
  const hit = SIZE_CHOICES.find((c) => c.value === size);
  return `Size: ${hit ? hit.label.replace('Size: ', '').replace(' · ', ' ') : size}`;
}

/** Tri-state booleans in a select: `'true'`/`'false'` ↔ `true`/`false`. */
export function boolPick(v: boolean | undefined): string | undefined {
  return v === undefined ? undefined : String(v);
}
export function boolFrom(v: string | undefined): boolean | undefined {
  return v === undefined ? undefined : v === 'true';
}

/* ── Recently added (G-HEALTH-4) ─────────────────────────────────────────── */

/** The old tile's window: "Added in the last 30 days" (`:26312`, `:26339`). */
export const RECENT_DAYS = 30;

/** `created_after` for "the last 30 days", as an ISO datetime. */
export function recentlyAddedSince(now: Date, days = RECENT_DAYS): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

/** The chip for a `created_after` filter — the date it counts from. */
export function addedSinceChip(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? `Added since ${iso}`
    : `Added since ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/* ── Tile links → the desk pre-filtered ──────────────────────────────────── */

/**
 * The params a link may open the Database with — the Dashboard's catalogue
 * tiles and the Data Health tiles (the old `dbGo({…})`, `:38120`, which reset
 * every filter and applied the tile's own). The old panel's rule, `:21349`:
 * a counter equals the list that opens when it is tapped.
 */
const LINKABLE = [
  'availability_status',
  'published',
  'complete',
  'duplicate_images',
  'has_images',
  'gallery_portal',
  'size',
  'source_type',
  'created_after',
] as const;
const BOOLEAN_PARAMS = new Set([
  'published',
  'complete',
  'duplicate_images',
  'has_images',
  'gallery_portal',
]);

export function artworkQueryFromParams(params: URLSearchParams): ArtworkAdminQuery {
  const q: Record<string, unknown> = {};
  for (const key of LINKABLE) {
    const raw = params.get(key);
    if (raw === null || raw === '') continue;
    if (BOOLEAN_PARAMS.has(key)) {
      if (raw === 'true' || raw === 'false') q[key] = raw === 'true';
    } else if (key === 'size') {
      if (SIZE_CHOICES.some((c) => c.value === raw)) q[key] = raw;
    } else {
      q[key] = raw;
    }
  }
  return q as ArtworkAdminQuery;
}

/** A Database link carrying `query`'s linkable filters. */
export function databaseLink(query: ArtworkAdminQuery): string {
  const sp = new URLSearchParams();
  for (const key of LINKABLE) {
    const v = query[key];
    if (v !== undefined && v !== null && v !== '') sp.set(key, String(v));
  }
  const s = sp.toString();
  return s ? `/admin/artworks?${s}` : '/admin/artworks';
}

/* ── The publish gate's refusal (G-CAT-8, C-10) ──────────────────────────── */

/**
 * The backend's `details.missing` tokens (`catalog/services.py:154-169`,
 * subset of title · size · medium · artist · price · image) in the old
 * `_appMissing` wording and order (`darz-studio.html:23971-23978`): image,
 * size, artist name, title, medium, price (or turn on “Price on request”).
 */
const MISSING_WORDS: ReadonlyArray<readonly [token: string, words: string]> = [
  ['image', 'image'],
  ['size', 'size'],
  ['artist', 'artist name'],
  ['title', 'title'],
  ['medium', 'medium'],
  ['price', 'price (or turn on “Price on request”)'],
];

/** The tokens in the old order, in the old words; an unknown token is shown
 * raw at the end rather than dropped. */
export function missingEssentials(tokens: readonly string[]): string[] {
  const known = MISSING_WORDS.filter(([t]) => tokens.includes(t)).map(([, w]) => w);
  const unknown = tokens.filter((t) => !MISSING_WORDS.some(([k]) => k === t));
  return [...known, ...unknown];
}

/** The `missing` list off a publish failure, or `null` when the failure is
 * something else (then the caller shows the error's own message). */
export function publishMissing(err: unknown): string[] | null {
  if (!(err instanceof ValidationError)) return null;
  const tokens = err.fields.missing;
  return Array.isArray(tokens) && tokens.length ? missingEssentials(tokens) : null;
}

/** The old refusal popup (`togglePub`, `:41959-41962`), verbatim around the
 * list: its `dzConfirm` with "Complete it now" / "Not now". */
export function publishRefusalLines(items: readonly string[]): string[] {
  return [
    'This artwork isn’t ready for the Market App yet.',
    `Please complete: ${items.join(', ')}.`,
    'Collectors only ever see complete listings, so it can’t go live until these are filled.',
  ];
}
