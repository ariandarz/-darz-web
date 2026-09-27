/**
 * Small, framework-free display helpers shared by the catalogue components.
 * Kept out of the components so they stay easy to unit test.
 */
import { asArray } from '../../api/shapes';
import type { OptionsMap } from '../../api/services';
import type { Artwork, Choice } from '../../api/types';

/** Tabular, exact — never rounded for drama (VOICE_AND_COPY.md). */
export function formatMoney(amount: string | number): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return String(amount);
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * The work's own image, or `null`.
 *
 * Total on purpose — it takes a missing artwork, not just missing images. The
 * un-total version read `artwork.images` and so threw
 * `Cannot read properties of undefined (reading 'images')` when a lot arrived
 * without its nested work, which **blanked the whole lot page** (the collector
 * app has no boundary under it, so that is a white screen, not a message).
 * Every caller here is a render path, and none of them has anything better to
 * do with a missing image than show none.
 */
export function primaryImage(
  artwork: Pick<Artwork, 'images'> | null | undefined,
): string | null {
  const images = asArray<Artwork['images'][number]>(artwork?.images);
  return images.find((img) => img.is_primary)?.image_url ?? images[0]?.image_url ?? null;
}

/**
 * The collector-facing availability word, read from `/api/options/`
 * (`catalog.availability_status`, the same source the admin desks use). The
 * six served labels are the words the hardcoded map here used to carry
 * (Available · On hold · Reserved · Sold · Archived · Withdrawn), so V1 Phase
 * 10 dropped the map; until the options arrive (or if they fail) the raw
 * value is humanised, which spells the same six words.
 */
export function availabilityLabel(
  status: string | null | undefined,
  options?: OptionsMap | null,
): string {
  // A row without the field (a partial nested artwork) renders no word — the
  // old map's `undefined` did the same.
  if (!status) return '';
  const served = asArray<Choice>(options?.['catalog.availability_status']).find(
    (c) => c.value === status,
  )?.label;
  if (served) return served;
  const words = status.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** `.d-status` modifier class — anything not literally available/reserved
 * falls back to the neutral "reserved" treatment rather than a 3rd colour. */
export function availabilityClass(status: string): string {
  return status === 'available' ? 'available' : 'reserved';
}

/** "120 x 150 cm" style dimension line — specific, not evocative. */
export function sizeLine(artwork: Pick<Artwork, 'dimensions' | 'medium' | 'year'>): string {
  return [artwork.dimensions, artwork.medium, artwork.year ? String(artwork.year) : '']
    .filter(Boolean)
    .join(' · ');
}

/** "122 x 210cm" / "93 × 120 cm" / "29.7 x 21cm" → width/height in cm, or
 * null when the string carries no two numbers. Used by View in Room to scale
 * the work on the wall (app.html `DZ.viewRoom` reads the same free-text
 * dimension line). */
export function parseDimensionsCm(dimensions: string | null | undefined): {
  w: number;
  h: number;
} | null {
  if (!dimensions) return null;
  const nums = dimensions.match(/\d+(?:[.,]\d+)?/g);
  if (!nums || nums.length < 2) return null;
  const w = Number(nums[0].replace(',', '.'));
  const h = Number(nums[1].replace(',', '.'));
  if (!(w > 0) || !(h > 0)) return null;
  return { w, h };
}
