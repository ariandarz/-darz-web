/**
 * artworkForm — the pure logic under the Artworks Database desk and its
 * editor. Kept out of the components so it is testable and reusable.
 */
import type { ArtworkAdmin } from '../../api/types';

/**
 * The backend's guarded availability state machine, ported verbatim from
 * `darzmarket-api/apps/catalog/lifecycle.py::AVAILABILITY_TRANSITIONS` so the
 * desk only ever offers a legal move (an illegal one is a 400). If the
 * backend table changes, this is the one place to update.
 */
export const AVAILABILITY_TRANSITIONS: Record<string, readonly string[]> = {
  available: ['on_hold', 'reserved', 'sold', 'withdrawn', 'archived'],
  on_hold: ['available', 'reserved'],
  reserved: ['available', 'sold'],
  sold: ['archived'],
  withdrawn: [],
  archived: [],
};

/** The legal next statuses from a given one — `[]` for a terminal status
 * (withdrawn / archived) and for anything unknown. */
export function transitionTargets(from: string): readonly string[] {
  return AVAILABILITY_TRANSITIONS[from] ?? [];
}

/**
 * Provenance keeps the old app's storage contract: ONE plain string, one
 * ownership stage per line (`darz-studio.html:34193` — "each line is its own
 * input … stored newline-separated … the Market App renders each line
 * separately"). These two are the row-editor's split/join.
 */
export function provenanceLines(value: string | null | undefined): string[] {
  const lines = String(value ?? '')
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return lines.length ? lines : [''];
}

export function joinProvenance(lines: readonly string[]): string {
  return lines
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n');
}

/** The editor's working copy — every field a string so inputs bind plainly;
 * `buildArtworkPayload` casts at the edge (the union-typed-draft lesson from
 * the Collectors form). */
export interface ArtworkDraft {
  artist: string; // artist uuid, '' = none
  artist_name_raw: string;
  title: string;
  year: string;
  medium: string;
  material: string;
  dimensions: string;
  edition: string;
  city: string;
  price_type: string;
  price_amount: string;
  currency: string;
  offer_floor: string;
  visibility: string;
  source_name: string;
  public_description: string;
  internal_notes: string;
  provenance: string; // newline-joined, managed by the row editor
  allowed_actions: string[];
}

export function draftFromArtwork(a: ArtworkAdmin | null): ArtworkDraft {
  return {
    artist: a?.artist ?? '',
    artist_name_raw: a?.artist_name_raw ?? '',
    title: a?.title ?? '',
    year: a?.year == null ? '' : String(a.year),
    medium: a?.medium ?? '',
    material: a?.material ?? '',
    dimensions: a?.dimensions ?? '',
    edition: a?.edition ?? '',
    city: a?.city ?? '',
    price_type: a?.price_type ?? 'on_request',
    price_amount: a?.price_amount ?? '',
    currency: (a?.currency as string | null) ?? '',
    offer_floor: a?.offer_floor ?? '',
    visibility: (a?.visibility as string | undefined) ?? 'internal_only',
    source_name: a?.source_name ?? '',
    public_description: a?.public_description ?? '',
    internal_notes: a?.internal_notes ?? '',
    provenance: a?.provenance ?? '',
    allowed_actions: Array.isArray(a?.allowed_actions) ? (a.allowed_actions as string[]) : [],
  };
}

/**
 * Draft → PATCH/POST body. Mirrors the server's own price rule
 * (`ArtworkService._clear_price_if_on_request` + the serializer's validate):
 * `on_request` carries no price data; `fixed`/`estimate` must carry both —
 * `priceProblem` reports that case so the form can refuse before the 400.
 */
export function buildArtworkPayload(d: ArtworkDraft): Partial<ArtworkAdmin> {
  const onRequest = d.price_type === 'on_request';
  return {
    artist: d.artist || null,
    artist_name_raw: d.artist_name_raw.trim(),
    title: d.title.trim(),
    year: d.year.trim() === '' ? null : Number(d.year),
    medium: d.medium.trim(),
    material: d.material.trim(),
    dimensions: d.dimensions.trim(),
    edition: d.edition.trim(),
    city: d.city.trim(),
    price_type: d.price_type as ArtworkAdmin['price_type'],
    price_amount: onRequest || d.price_amount.trim() === '' ? null : d.price_amount.trim(),
    currency: (onRequest || !d.currency ? null : d.currency) as ArtworkAdmin['currency'],
    offer_floor: d.offer_floor.trim() === '' ? null : d.offer_floor.trim(),
    visibility: d.visibility as ArtworkAdmin['visibility'],
    source_name: d.source_name.trim(),
    public_description: d.public_description,
    internal_notes: d.internal_notes,
    provenance: joinProvenance(provenanceLines(d.provenance)),
    allowed_actions: d.allowed_actions,
  };
}

/** "fixed/estimate must carry a real price_amount+currency" — the
 * serializer's own validation, run client-side first. Returns the message to
 * show, or null when fine. */
export function priceProblem(d: ArtworkDraft): string | null {
  if (d.price_type !== 'fixed' && d.price_type !== 'estimate') return null;
  if (d.price_amount.trim() === '' || !d.currency) {
    return 'A fixed or estimate price needs both an amount and a currency — or set “On request”.';
  }
  return null;
}

/** Toggle one collector action in the `allowed_actions` list. The EMPTY list
 * means "all four allowed" (default-open, the model's own contract) — the
 * editor renders that state as every box ticked. */
export function toggleAction(
  list: readonly string[],
  kind: string,
  all: readonly string[],
): string[] {
  const effective = list.length === 0 ? [...all] : [...list];
  const next = effective.includes(kind)
    ? effective.filter((k) => k !== kind)
    : [...effective, kind];
  // back to the canonical "all allowed" spelling when everything is on again
  return all.every((k) => next.includes(k)) ? [] : next;
}

/** Is this action on, given the empty-means-all rule? */
export function actionOn(list: readonly string[], kind: string): boolean {
  return list.length === 0 || list.includes(kind);
}
