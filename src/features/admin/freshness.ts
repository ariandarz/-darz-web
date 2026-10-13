/**
 * freshness — the pure half of the source-freshness loop (G-CAT-9, backend
 * 2026-10-01): the old panel's `spFreshness` lifecycle (`darz-studio.html:
 * 27022-27051`, v736) read off the server instead of computed here.
 *
 * The server owns the bands and the words. Every admin artwork row carries
 * `freshness {state, label, days, confirmed_at}` (≤30 fresh · `new` never
 * confirmed · 31–60 due · 61–90 stale · >90 risky), and `label` is the old
 * tile's own text ("Confirmed 12d ago", "Needs update", "Not confirmed 75d",
 * "Risky · 120d", "Awaiting first confirm"), so this file never re-derives a
 * band from a date — it maps the old desk's controls onto the server's
 * filters and keeps the copy in one place.
 *
 * Not ported: the old v1230 "Review periods" selects (`:43567-43570`, the
 * 30/60/90 thresholds made editable). The backend's thresholds are constants
 * (`apps/catalog/freshness.py`), so there is nothing for such a select to
 * write — flagged, not faked.
 */
import type {
  ArtworkAdmin,
  ArtworkAdminQuery,
  FreshnessState,
  FreshnessSummary,
} from '../../api/types';
import { transitionTargets } from './artworkForm';

export const FRESHNESS_STATES: readonly FreshnessState[] = [
  'fresh',
  'new',
  'due',
  'stale',
  'risky',
];

/** The three bands that count toward "needs reconfirmation" — the old
 * `spStaleCount` (`:27051`) and the server's `NEEDS_RECONFIRMATION_STATES`. */
export const NEEDS_RECONFIRMATION: readonly FreshnessState[] = ['due', 'stale', 'risky'];

/** The Artwork Sources tab's confirmation select (`:27433`), verbatim — the
 * day counts in the labels match the server's fixed bands. "Confirmation:
 * all" is the select's any-option. */
export type FreshnessFilter = 'attention' | FreshnessState;
export const FRESHNESS_FILTERS: ReadonlyArray<{ value: FreshnessFilter; label: string }> = [
  { value: 'attention', label: 'Needs attention' },
  { value: 'fresh', label: 'Confirmed this month' },
  { value: 'due', label: 'Needs update (30d+)' },
  { value: 'stale', label: 'Stale (60d+)' },
  { value: 'risky', label: 'Risky (90d+)' },
  { value: 'new', label: 'Never confirmed' },
];

/**
 * The admin list params for one confirmation filter.
 *
 * Both server filters restrict to SOURCE-LINKED works (a `source_name` or a
 * `source_type`), which is exactly the old tab's scope ("Every artwork
 * attributed to a gallery, dealer or artist", `:27437`). So "Confirmation:
 * all" is every band at once — the one way to ask the list for "every
 * source-linked work", since the API has no has-a-source filter of its own.
 * "Needs attention" is `needs_reconfirmation` (due + stale + risky).
 */
export function freshnessQuery(
  filter: FreshnessFilter | undefined,
): Pick<ArtworkAdminQuery, 'freshness' | 'needs_reconfirmation'> {
  if (filter === 'attention') return { freshness: undefined, needs_reconfirmation: true };
  if (filter) return { freshness: filter, needs_reconfirmation: undefined };
  return { freshness: [...FRESHNESS_STATES], needs_reconfirmation: undefined };
}

/** Which filter a query is on — the inverse of `freshnessQuery`. */
export function freshnessFilterOf(q: ArtworkAdminQuery): FreshnessFilter | undefined {
  if (q.needs_reconfirmation) return 'attention';
  if (typeof q.freshness === 'string') return q.freshness;
  return undefined;
}

/** `spRemindBanner` (`:27444-27453`) — "2 risky (90d+) · 1 stale (60d+) ·
 * 3 due (30d+)", worst first, zero bands left out. */
export function remindParts(s: Pick<FreshnessSummary, 'risky' | 'stale' | 'due'>): string {
  const parts: string[] = [];
  if (s.risky) parts.push(`${s.risky} risky (90d+)`);
  if (s.stale) parts.push(`${s.stale} stale (60d+)`);
  if (s.due) parts.push(`${s.due} due (30d+)`);
  return parts.join(' · ');
}

/** The Market App desk's alert (`workspaces-runtime.js:751`) words the same
 * three bands without the day counts. */
export function marketRemindParts(
  s: Pick<FreshnessSummary, 'risky' | 'stale' | 'due'>,
): string {
  return [
    s.risky ? `${s.risky} risky` : '',
    s.stale ? `${s.stale} stale` : '',
    s.due ? `${s.due} due` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** A sold / withdrawn / archived work takes no part in the loop — the old
 * `spIsArchived` (`:27022-27023`) and the server's
 * `_FRESHNESS_INACTIVE_STATUSES`. Its tile shows no confirm row. */
const INACTIVE = new Set(['sold', 'withdrawn', 'archived']);
export function takesPart(w: Pick<ArtworkAdmin, 'availability_status'>): boolean {
  return !INACTIVE.has(String(w.availability_status ?? ''));
}

/** Source-linked = a `source_name` or a `source_type` (the server's
 * `is_source_linked`). A Darz-inventory work has no source to reconfirm. */
export function isSourceLinked(w: Pick<ArtworkAdmin, 'source_name' | 'source_type'>): boolean {
  return !!(String(w.source_name ?? '').trim() || w.source_type);
}

/** The pill's tooltip (`:27077`). */
export function freshTitle(confirmedAt: string | null | undefined): string {
  return confirmedAt
    ? `Last confirmed ${new Date(confirmedAt).toLocaleDateString('en-GB')}`
    : 'Never confirmed by its source';
}

/**
 * The tile's "Update…" select (`:27080`): confirm AND record what the source
 * said. `price` confirms and opens the editor (`spConfirmAs`, `:38151`);
 * `remove` is the old "Remove from market" → `withdrawn`. A status option is
 * offered only when it is the work's own status (a plain re-confirm, which the
 * server allows) or a legal move from it — an illegal one is a 400, and the
 * Database desk already never offers one (`transitionTargets`).
 */
export type ConfirmAs = 'available' | 'reserved' | 'sold' | 'price' | 'remove';
const CONFIRM_AS: ReadonlyArray<{ value: ConfirmAs; label: string; status?: string }> = [
  { value: 'available', label: 'Available', status: 'available' },
  { value: 'reserved', label: 'Reserved', status: 'reserved' },
  { value: 'sold', label: 'Sold', status: 'sold' },
  { value: 'price', label: 'Price changed' },
  { value: 'remove', label: 'Remove from market', status: 'withdrawn' },
];

export function confirmAsOptions(
  current: string,
): ReadonlyArray<{ value: ConfirmAs; label: string; status?: string }> {
  const legal = new Set([current, ...transitionTargets(current)]);
  return CONFIRM_AS.filter((o) => !o.status || legal.has(o.status));
}

export function confirmAsStatus(v: ConfirmAs): string | undefined {
  return CONFIRM_AS.find((o) => o.value === v)?.status;
}

/** The owner card's day choices (`:27457`, 60/90/120), plus the stored value
 * when it is something else — the server takes any whole number, and a
 * `<select>` whose value has no option silently shows a different one. */
export function hideDayChoices(current: number | undefined): number[] {
  const base = [60, 90, 120];
  return current && !base.includes(current) ? [...base, current].sort((a, b) => a - b) : base;
}
