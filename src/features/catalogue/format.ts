/**
 * Small, framework-free display helpers shared by the catalogue components.
 * Kept out of the components so they stay easy to unit test.
 */
import type { Artwork } from '../../api/types';

/** Tabular, exact — never rounded for drama (VOICE_AND_COPY.md). */
export function formatMoney(amount: string | number): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return String(amount);
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function primaryImage(artwork: Pick<Artwork, 'images'>): string | null {
  const images = artwork.images ?? [];
  return images.find((img) => img.is_primary)?.image_url ?? images[0]?.image_url ?? null;
}

const AVAILABILITY_LABEL: Record<string, string> = {
  available: 'Available',
  on_hold: 'On hold',
  reserved: 'Reserved',
  sold: 'Sold',
  archived: 'Archived',
  withdrawn: 'Withdrawn',
};

export function availabilityLabel(status: string): string {
  return AVAILABILITY_LABEL[status] ?? status;
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
