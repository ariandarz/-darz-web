/**
 * pricelistFields — a portal-BUILT pricelist (P3b lines) turned into what the
 * formatted Darz pricelist sheet prints (P3c, `pricelistPdf.tsx`). Pure, so the
 * reading of each line is pinned by a node test without drawing a PDF.
 *
 * A line is a work assigned to the portal (`artwork`) or a typed title; the
 * builder's own placeholder for a typed one is "Artist — title", so that is
 * how one is split. An assigned work reads its artist, year, medium and size
 * off the link's snapshot — the same copy the gallery priced it from.
 */
import type { Choice, GalleryLinkArtwork, GalleryPricelistAdmin } from '../../../api/types';
import { fmtThousands } from '../../portal/portalForm';

export interface PricelistPdfLine {
  artist: string;
  title: string;
  year: string;
  /** medium · size · availability · note — the old `.dt` line */
  details: string;
  /** grouped, without a trailing `.00`; '' = "Price on request" */
  price: string;
  currency: string;
}

export interface PricelistPdfFields {
  /** the old `.pl-eyebrow` — whose pricelist it is */
  eyebrow: string;
  title: string;
  /** the old `.pl-sub` — the gallery's own notes, when there are any */
  intro: string;
  /** the old `.pl-date` — the day Darz formatted it */
  date: string;
  lines: PricelistPdfLine[];
  /** the old `_defaultFootL` (`pricelist.html:611-613`) */
  foot: string;
}

/** "52000.00" → "52,000"; "52000.5" → "52,000.5"; null → "". */
export function priceText(price: string | null | undefined): string {
  const raw = String(price ?? '').trim();
  if (!raw) return '';
  return fmtThousands(raw.replace(/\.0+$/, ''));
}

/** Snapshot fields read as text (the snapshot is a free-form JSON blob). */
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));

export function pricelistPdfFields(
  pl: Pick<GalleryPricelistAdmin, 'title' | 'notes' | 'lines'>,
  sourceName: string,
  works: readonly Pick<GalleryLinkArtwork, 'artwork' | 'snapshot'>[],
  availability: readonly Choice[],
  today: Date = new Date(),
): PricelistPdfFields {
  const byArtwork = new Map(
    works.map((w) => [w.artwork, w.snapshot as Record<string, unknown>]),
  );
  const availLabel = (v: string) => availability.find((c) => c.value === v)?.label ?? v;
  const lines = [...(Array.isArray(pl.lines) ? pl.lines : [])]
    .sort((a, b) => a.position - b.position)
    .map((l): PricelistPdfLine => {
      const snap = l.artwork ? byArtwork.get(l.artwork) : undefined;
      let artist = txt(snap?.artist);
      let title = l.work_title.trim() || txt(snap?.title);
      if (!snap && title.includes(' — ')) {
        const at = title.indexOf(' — ');
        artist = title.slice(0, at).trim();
        title = title.slice(at + 3).trim();
      } else if (snap && artist && title.startsWith(`${artist} — `)) {
        // the gallery typed "Artist — title" over an assigned work too
        title = title.slice(artist.length + 3).trim();
      }
      const details = [
        txt(snap?.medium),
        txt(snap?.dimensions),
        l.availability ? availLabel(l.availability) : '',
        l.note.trim(),
      ]
        .filter(Boolean)
        .join('  ·  ');
      return {
        artist,
        title: title || 'Untitled',
        year: txt(snap?.year),
        details,
        price: priceText(l.price),
        currency: l.price ? l.currency : '',
      };
    });
  return {
    eyebrow: sourceName,
    title: pl.title.trim() || 'Pricelist',
    intro: pl.notes.trim(),
    date: today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    lines,
    foot: 'darzmarket.art · The Iranian Art Platform · Tehran',
  };
}

/** `aria-gallery-pricelist-2026-10.pdf` — what the stored file is called. */
export function pricelistFilename(sourceName: string, today: Date = new Date()): string {
  const slug =
    sourceName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'partner';
  return `${slug}-pricelist-${today.toISOString().slice(0, 7)}.pdf`;
}
