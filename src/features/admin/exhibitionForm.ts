/**
 * exhibitionForm — pure logic for the Exhibition Services desk (the admin
 * half of the gallery loop) and the update-review queue's human diff.
 *
 * Old-system sources: the desk side of `gallery-update.html`'s §78/§91
 * workspace lives in `darz-studio.html`'s gallery passport; the document
 * shapes are the golden fixtures (`test/fixtures/proposal-golden.html`,
 * `invoice-golden.html`) and the reference rule is
 * `packages/domain/doc-reference.js` (v1185): per-series, per-year, issued
 * once and SAVED WITH THE DOCUMENT — never re-derived — with `next()`
 * taking max(highest seen) before incrementing.
 */
import type {
  ExhibitionAdmin,
  ExhibitionLineInput,
  GalleryUpdateAdmin,
  PortalCatalogueEntry,
  PortalServiceLine,
} from '../../api/types';
import { curSym, fmtDate, fmtThousands } from '../portal/portalForm';

/* ── the lines editor model ─────────────────────────────────────────────── */

export interface LineDraft {
  service_key: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  status: 'proposed' | 'confirmed' | 'declined' | 'delivered';
  admin_note: string;
}

function draftFromLine(l: PortalServiceLine): LineDraft {
  return {
    service_key: l.service_key,
    title: l.title,
    description: l.description,
    price: l.price === null || l.price === '' ? '' : fmtThousands(l.price),
    currency: l.currency || '',
    status: l.status,
    admin_note: l.admin_note,
  };
}

export function draftFromCatalogue(entry: PortalCatalogueEntry, currency: string): LineDraft {
  return {
    service_key: entry.key,
    title: entry.title,
    description: entry.description,
    price: entry.default_price === null ? '' : fmtThousands(entry.default_price),
    currency,
    status: 'proposed',
    admin_note: '',
  };
}

/**
 * The composer opens on what is real: the composed lines when Darz already
 * priced the package, else the source's OWN ticks seeded from the catalogue
 * ("the gallery picks, Darz prices" — a request never starts empty on the
 * desk).
 */
export function seedLines(
  ev: ExhibitionAdmin,
  catalogue: PortalCatalogueEntry[],
): LineDraft[] {
  if (ev.service_lines.length) return ev.service_lines.map(draftFromLine);
  const byKey = new Map(catalogue.map((c) => [c.key, c]));
  const cur = ev.currency || 'TMN';
  return ev.gallery_selected.map((key) => {
    const entry = byKey.get(key);
    return entry
      ? draftFromCatalogue(entry, cur)
      : {
          service_key: key,
          title: key,
          description: '',
          price: '',
          currency: cur,
          status: 'proposed' as const,
          admin_note: '',
        };
  });
}

const cleanAmount = (v: string) => v.replace(/[,\s ٬]/g, '');

export function toLineInputs(drafts: LineDraft[]): ExhibitionLineInput[] {
  return drafts.map((d, position) => ({
    service_key: d.service_key || d.title.toLowerCase().replace(/\s+/g, '_').slice(0, 60),
    title: d.title,
    description: d.description,
    price: d.price.trim() === '' ? null : cleanAmount(d.price),
    currency: d.currency,
    status: d.status,
    admin_note: d.admin_note,
    position,
  }));
}

export interface LineTotals {
  sub: number;
  disc: number;
  tot: number;
  count: number;
  unpriced: number;
}

/** Declined lines never count — the portal's own totals rule. */
export function lineTotals(lines: LineDraft[], discount: string): LineTotals {
  let sub = 0;
  let unpriced = 0;
  for (const l of lines) {
    if (l.status === 'declined') continue;
    const n = parseFloat(cleanAmount(l.price));
    if (Number.isFinite(n)) sub += n;
    else unpriced++;
  }
  const disc = parseFloat(cleanAmount(discount)) || 0;
  return { sub, disc, tot: Math.max(0, sub - disc), count: lines.length, unpriced };
}

export function money(currency: string | null | undefined, n: number): string {
  return curSym(currency) + fmtThousands(Math.round(n));
}

/* ── the review queue's human diff ──────────────────────────────────────── */

export interface ReviewRow {
  label: string;
  /** "was → now" when both sides exist; a plain value otherwise */
  from?: string;
  to: string;
}

const s = (v: unknown) => (v == null ? '' : String(v));

/**
 * A submitted update, in words — the queue's reviewer reads THIS, with the
 * raw payload kept behind a fold. Field names follow the portal's
 * `buildUpdatePayload` (portalForm.ts) and the old page's own vocabulary.
 */
export function describeUpdate(u: Pick<GalleryUpdateAdmin, 'kind' | 'payload'>): ReviewRow[] {
  const p = (u.payload ?? {}) as Record<string, unknown>;
  const rows: ReviewRow[] = [];
  const has = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';

  if (u.kind === 'new') {
    for (const [key, label] of [
      ['artist', 'Artist'],
      ['title', 'Title'],
      ['year', 'Year'],
      ['medium', 'Medium'],
      ['dimensions', 'Size'],
    ] as const)
      if (has(p[key])) rows.push({ label, to: s(p[key]) });
    if (has(p.price))
      rows.push({ label: 'Price', to: `${s(p.price)} ${s(p.currency)}`.trim() });
    if (has(p.status)) rows.push({ label: 'Availability', to: s(p.status) });
  } else {
    if (has(p.availability_status))
      rows.push({
        label: 'Availability',
        from: s(p.fromStatus),
        to: s(p.availability_status),
      });
    else if (p.confirmAvailable === true)
      rows.push({ label: 'Availability', to: 'confirmed still available' });
    if (has(p.price_amount)) {
      const from = has(p.fromPrice)
        ? `${fmtThousands(s(p.fromPrice))} ${s(p.fromCurrency)}`.trim()
        : '';
      rows.push({
        label: 'Price',
        from: from || undefined,
        to: `${fmtThousands(s(p.price_amount))} ${s(p.currency) || s(p.fromCurrency)}`.trim(),
      });
    }
    if (p.needsCorrection === true)
      rows.push({ label: 'Flag', to: 'some details need correcting' });
    if (p.imageNeedsUpdate === true)
      rows.push({ label: 'Flag', to: 'the image needs updating' });
    if (p.viewing === true)
      rows.push({ label: 'Offer', to: 'available for a private viewing' });
    if (p.hold2w === true)
      rows.push({ label: 'Offer', to: 'can hold this work for two weeks' });
    if (has(p.city)) rows.push({ label: 'City', to: s(p.city) });
    if (has(p.shippingNote)) rows.push({ label: 'Shipping', to: s(p.shippingNote) });
    if (has(p.provenance)) rows.push({ label: 'Provenance', to: s(p.provenance) });
    if (Array.isArray(p.offer_actions))
      rows.push({
        label: 'Collector actions',
        to: (p.offer_actions as unknown[]).map(s).join(', ') || 'none',
      });
    if (has(p.offer_floor))
      rows.push({
        label: 'Minimum offer (private)',
        to: `${fmtThousands(s(p.offer_floor))} ${s(p.offer_currency)}`.trim(),
      });
  }
  if (has(p.note)) rows.push({ label: 'Note', to: s(p.note) });
  if (has(p.staff)) rows.push({ label: 'Sent by', to: s(p.staff) });
  return rows;
}

/* ── document references + field blobs (doc-reference.js v1185) ─────────── */

export const DOC_SERIES = {
  exhibition_proposal: { code: 'PRO', label: 'Exhibition proposal' },
  exhibition_invoice: { code: 'SINV', label: 'Services invoice' },
} as const;

export type ExhibitionDocKind = keyof typeof DOC_SERIES;

/**
 * Every document kind that draws its numbers from a series — the scan that
 * prefills a reference has to read ALL of them or the number repeats.
 *
 * `PRO` is shared: an exhibition proposal and a project proposal
 * (`projects/projectForm.ts::PROPOSAL_SERIES`) are one series of Darz
 * proposals, stored under two kinds because they hang off different records.
 * `SINV` has one kind today and is listed for the same reason.
 */
export const SERIES_KINDS: Record<string, readonly string[]> = {
  PRO: ['exhibition_proposal', 'proposal'],
  SINV: ['exhibition_invoice'],
};

/**
 * `DARZ-<code>-<year>-<NNNN>` — the next number in this series and year,
 * scanned from the references already saved on documents (rule 4: take the
 * highest seen before incrementing; rule 1 keeps every issued number with
 * its document forever, so the scan is the counter).
 */
export function nextReference(
  existing: Array<string | undefined | null>,
  code: string,
  year: number,
): string {
  const rx = new RegExp(`^DARZ-${code}-${year}-(\\d{4})$`);
  let max = 0;
  for (const ref of existing) {
    const m = rx.exec(String(ref ?? ''));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `DARZ-${code}-${year}-${String(max + 1).padStart(4, '0')}`;
}

export interface DocumentLineField {
  title: string;
  description: string;
  /** display-ready or '' for "on request" */
  price: string;
  currency: string;
}

export interface BankDetails {
  holder: string;
  bank: string;
  card: string;
  iban: string;
}

/**
 * The self-contained blob a proposal/invoice PDF renders from — a SNAPSHOT
 * of the package at issue time (golden-fixture anatomy). Stored as
 * `Document.fields`; never re-derived from the live event.
 */
export function buildDocumentFields(
  kind: ExhibitionDocKind,
  ev: ExhibitionAdmin,
  partnerName: string,
  lines: LineDraft[],
  opts: { reference: string; note?: string; terms?: string; bank?: BankDetails },
): Record<string, unknown> {
  const included = lines.filter((l) => l.status !== 'declined');
  const totals = lineTotals(lines, ev.discount);
  const currency = ev.currency || included[0]?.currency || 'TMN';
  const fields: Record<string, unknown> = {
    reference: opts.reference,
    doc_label: DOC_SERIES[kind].label,
    issued_at: new Date().toISOString().slice(0, 10),
    show: {
      title: ev.title,
      gallery: partnerName,
      artists: ev.artists,
      dates: ev.event_date,
      venue: ev.venue,
      project: ev.project,
    },
    lines: included.map((l): DocumentLineField => ({
      title: l.title,
      description: l.description,
      price: l.price.trim() === '' ? '' : fmtThousands(l.price),
      currency: l.currency || currency,
    })),
    currency,
    subtotal: totals.sub,
    discount: totals.disc,
    total: totals.tot,
    note: opts.note || '',
    terms: opts.terms || '',
  };
  if (kind === 'exhibition_invoice') {
    fields.billed_to = partnerName;
    if (opts.bank && (opts.bank.holder || opts.bank.iban || opts.bank.card || opts.bank.bank))
      fields.bank = { ...opts.bank };
  }
  return fields;
}

/** One meta line for a show row — shared by the queue and the partner page
 * so the two can never drift apart in wording. */
export function exhibitionMetaLine(ev: ExhibitionAdmin): string {
  return (
    [ev.event_date, ev.venue, ev.artists].filter(Boolean).join(' · ') || fmtDate(ev.created_at)
  );
}
