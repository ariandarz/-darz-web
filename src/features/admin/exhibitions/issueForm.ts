/**
 * issueForm — the arithmetic and the document body behind "Issue a document".
 *
 * The desk used to reach a proposal through four stacked sections and a modal
 * sub-form, with the price typed in one place and the note in another. The
 * owner asked for one page: pick the show, pick proposal or invoice, add
 * services from the library, adjust, see exactly what the client gets, issue.
 * Everything that page computes lives here, pure, so the page itself is layout
 * and the numbers are testable.
 *
 * QUANTITY. `ExhibitionServiceLine` (`apps/gallery/models.py:299-325`) stores
 * `price` and no quantity, so a package of "3 × artwork photography" had
 * nowhere to say three. The document does: `Document.fields` is free-form JSON
 * and IS the artefact the client receives. So a line carries `qty` and
 * `unit_price` onto the document, and the exhibition line is written with
 * `price` = the line AMOUNT — which is what the portal shows the gallery and
 * what every total already sums. Nothing is double-counted and nothing is
 * invented. Recorded as G-PORT-16.
 *
 * DISCOUNT is a plain amount in the package currency, as `ExhibitionEvent`
 * already stores it (`discount`, a decimal) — not a percentage. `lineTotals`
 * in `exhibitionForm.ts` reads it the same way, so a package composed on the
 * old desk and one issued here agree.
 */
import type { DocumentAdmin, ExhibitionAdmin, ExhibitionLineInput } from '../../../api/types';
import type { DocumentPdfFields } from '../pdf/documentPdf';
import {
  DOC_SERIES,
  nextReference,
  type BankDetails,
  type ExhibitionDocKind,
} from '../exhibitionForm';

/** One line on the document being issued. */
export interface IssueLine {
  /** `gallery.exhibition_service` key, or '' for a line typed by hand. */
  key: string;
  title: string;
  description: string;
  /** Whole units. Kept as a string so a half-typed field is not a 0. */
  qty: string;
  /** Price for ONE unit, as typed — digits with or without separators. */
  unitPrice: string;
}

export const blankLine = (): IssueLine => ({
  key: '',
  title: '',
  description: '',
  qty: '1',
  unitPrice: '',
});

/** Digits only: "1,200,000" and "1 200 000" and "۱۲۰۰" all mean the number. */
export function num(v: string | number | null | undefined): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const cleaned = String(v ?? '').replace(/[,\s٬،']/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Thousands separators for display; never rounds, never adds decimals. */
export function group(n: number): string {
  const [whole, frac] = String(n).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac}` : grouped;
}

/** A line's own amount: quantity × unit price. An empty price is 0, not a
 * guess — an unpriced line still prints, it just adds nothing. */
export function lineAmount(l: IssueLine): number {
  return Math.max(0, qtyOf(l)) * num(l.unitPrice);
}

/** At least one: a line on a document is one of something. */
export function qtyOf(l: IssueLine): number {
  const n = Math.floor(num(l.qty));
  return n > 0 ? n : 1;
}

export interface IssueTotals {
  subtotal: number;
  discount: number;
  total: number;
  /** Lines with no unit price — the desk says how many rather than pretending. */
  unpriced: number;
}

export function issueTotals(lines: readonly IssueLine[], discount: string): IssueTotals {
  const subtotal = lines.reduce((sum, l) => sum + lineAmount(l), 0);
  // a discount can never exceed the subtotal, and never turns a total negative
  const disc = Math.min(Math.max(0, num(discount)), subtotal);
  return {
    subtotal,
    discount: disc,
    total: subtotal - disc,
    unpriced: lines.filter((l) => l.unitPrice.trim() === '' || num(l.unitPrice) === 0).length,
  };
}

/** A line the desk would send to the backend: `price` is the line AMOUNT. */
export function toWireLines(
  lines: readonly IssueLine[],
  currency: string,
): ExhibitionLineInput[] {
  return lines.map((l, position) => ({
    service_key: l.key || slugKey(l.title),
    title: l.title,
    description: l.description,
    price: l.unitPrice.trim() === '' ? null : String(lineAmount(l)),
    currency,
    status: 'proposed',
    admin_note: '',
    position,
  }));
}

/** A key for a line typed by hand — the shape the backend's freeform
 * `service_key` takes elsewhere in this desk (`toLineInputs`). */
export function slugKey(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, '_').slice(0, 60);
}

export interface IssueDraft {
  kind: ExhibitionDocKind;
  reference: string;
  lines: readonly IssueLine[];
  currency: string;
  discount: string;
  note: string;
  terms: string;
  bank?: BankDetails;
  /** Today, as the caller reads the clock — never read here, so this stays pure. */
  issuedAt: string;
}

/**
 * The document body: exactly what the PDF prints and what is stored on the
 * record, so the preview on screen and the file the client opens are built
 * from one object and cannot drift.
 */
export function buildIssueFields(
  ev: Pick<ExhibitionAdmin, 'title' | 'artists' | 'event_date' | 'venue' | 'project'>,
  partnerName: string,
  draft: IssueDraft,
): DocumentPdfFields & Record<string, unknown> {
  const totals = issueTotals(draft.lines, draft.discount);
  const fields: DocumentPdfFields & Record<string, unknown> = {
    reference: draft.reference,
    doc_label: DOC_SERIES[draft.kind].label,
    issued_at: draft.issuedAt,
    show: {
      title: ev.title,
      gallery: partnerName,
      artists: ev.artists,
      dates: ev.event_date,
      venue: ev.venue,
      project: ev.project,
    },
    lines: draft.lines.map((l) => ({
      title: l.title,
      description: l.description,
      // the amount is what the line costs; qty and unit price explain it
      price: l.unitPrice.trim() === '' ? '' : group(lineAmount(l)),
      currency: draft.currency,
      qty: qtyOf(l),
      unit_price: l.unitPrice.trim() === '' ? '' : group(num(l.unitPrice)),
    })),
    currency: draft.currency,
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    note: draft.note,
    terms: draft.terms,
  };
  if (draft.kind === 'exhibition_invoice') {
    fields.billed_to = partnerName;
    const b = draft.bank;
    if (b && (b.holder || b.bank || b.card || b.iban)) fields.bank = { ...b };
  }
  return fields;
}

/** The next reference in a series, from every document already stored in it.
 * A thin pass-through so the page imports one module, not two. */
export function referenceFrom(
  documents: readonly DocumentAdmin[],
  kind: ExhibitionDocKind,
  year: number,
): string {
  const refOf = (d: DocumentAdmin) =>
    ((d.fields ?? {}) as Record<string, unknown>).reference as string | undefined;
  return nextReference(documents.map(refOf), DOC_SERIES[kind].code, year);
}

/** What stops the Issue button, in the order a reader would hit it. One
 * sentence, or null when the document is ready to go out. */
export function whyNotReady(
  eventId: string,
  draft: Pick<IssueDraft, 'reference' | 'lines'>,
): string | null {
  if (!eventId) return 'Choose the exhibition this document is for.';
  if (!draft.lines.length) return 'Add at least one service.';
  if (draft.lines.some((l) => !l.title.trim())) return 'Every line needs a name.';
  if (!draft.reference.trim()) return 'The document needs a reference.';
  return null;
}
