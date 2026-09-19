/**
 * DocumentPreview — the document on screen, as the client will read it.
 *
 * WHY NOT THE PDF ITSELF. The first version put the real `@react-pdf/renderer`
 * output in an `<iframe>`. It is the literal artefact, so it looked like the
 * honest choice — but an iframe showing a PDF depends on the browser having a
 * PDF viewer, and in the one I can actually verify against it renders a blank
 * pane. A preview I cannot see is a preview I cannot promise, and it also cost
 * a full PDF render on a debounce after every keystroke.
 *
 * So the pane is an HTML twin, built from the SAME `DocumentPdfFields` object
 * the PDF is built from and the issue stores — one source, so the words, the
 * lines, the quantities and the totals cannot differ. Only the typography is
 * the browser's rather than the PDF's, and `Open the PDF` beside it renders
 * the real file for the final look.
 *
 * Every block below mirrors `documentPdf.tsx` in the same order: the masthead
 * and the reference, the show, the facts, the lines (with the quantity line
 * where there is a real multiple), the totals, the note, the bank block on an
 * invoice, and the terms.
 */
import type { DocumentPdfFields } from '../pdf/documentPdf';
import './exhibitions.css';

const SYM: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', TMN: 'T ', T: 'T ' };

const sym = (currency: string | undefined) =>
  SYM[String(currency ?? '').toUpperCase()] ?? (currency ? `${currency} ` : '');

const money = (currency: string | undefined, n: number | undefined) =>
  n === undefined ? '' : `${sym(currency)}${n.toLocaleString('en-GB')}`;

export function DocumentPreview({ fields }: { fields: DocumentPdfFields }) {
  const invoice = fields.doc_label?.toLowerCase().includes('invoice') ?? false;
  const show = fields.show ?? {};
  const lines = fields.lines ?? [];
  const bank = fields.bank ?? {};

  const facts: Array<[string, string | undefined]> = [
    ['Dates', show.dates],
    ['Space', show.venue],
    ['Project', show.project],
  ];
  if (invoice) facts.unshift(['Billed to', fields.billed_to]);
  const shownFacts = facts.filter(([, v]) => v);

  const bankRows: Array<[string, string | undefined]> = [
    ['Account holder', bank.holder],
    ['Bank', bank.bank],
    ['Card no.', bank.card],
    ['Sheba (IBAN)', bank.iban],
  ].filter(([, v]) => v) as Array<[string, string]>;

  return (
    <article className="dzd" aria-label="Document preview">
      <header className="dzd-top">
        <div className="dzd-wm">
          darz<b>.art</b>
        </div>
        <div className="dzd-meta">
          <div className="dzd-kicker">
            {fields.doc_label ?? (invoice ? 'Services invoice' : 'Exhibition proposal')}
          </div>
          <Meta k="Issued by" v="Darz.art" />
          <Meta k="Issued" v={fields.issued_at} />
          <Meta k="Reference" v={fields.reference} />
        </div>
      </header>
      <div className="dzd-seam" />

      <h1 className="dzd-h1">{show.title || 'Untitled exhibition'}</h1>
      <div className="dzd-sub">{[show.gallery, show.artists].filter(Boolean).join(' · ')}</div>

      {shownFacts.length > 0 && (
        <div className="dzd-facts">
          {shownFacts.map(([k, v]) => (
            <div className="dzd-fact" key={k}>
              <div className="dzd-factk">{k}</div>
              <div className="dzd-factv">{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="dzd-sec">
        {fields.lines_label ??
          (invoice ? 'Exhibition services' : 'Proposed for this exhibition')}
      </div>

      {lines.length === 0 && <div className="dzd-empty">No services on it yet.</div>}
      {lines.map((l, i) => (
        <div className="dzd-line" key={i}>
          <div className="dzd-linemain">
            <div className="dzd-linet">{l.title || '—'}</div>
            {l.description && <div className="dzd-lined">{l.description}</div>}
            {(l.qty ?? 1) > 1 && l.unit_price ? (
              <div className="dzd-lineq">
                {l.qty} × {sym(l.currency)}
                {l.unit_price}
              </div>
            ) : null}
          </div>
          <div className="dzd-linep">
            {l.price ? `${sym(l.currency)}${l.price}` : 'On confirmation'}
          </div>
        </div>
      ))}

      {fields.total !== undefined && (
        <div className="dzd-totals">
          <div className="dzd-totrow">
            <span>Subtotal</span>
            <span>{money(fields.currency, fields.subtotal)}</span>
          </div>
          {(fields.discount ?? 0) > 0 && (
            <div className="dzd-totrow">
              <span>Discount</span>
              <span>−{money(fields.currency, fields.discount)}</span>
            </div>
          )}
          <div className="dzd-totrow dzd-grand">
            <span>{invoice ? 'Total due' : 'Total'}</span>
            <span>{money(fields.currency, fields.total)}</span>
          </div>
        </div>
      )}

      {fields.note && (
        <div className="dzd-note">
          <div className="dzd-notek">Note from Darz</div>
          <div className="dzd-notev">{fields.note}</div>
        </div>
      )}

      {invoice && bankRows.length > 0 && (
        <>
          <div className="dzd-sec">Bank account details</div>
          <div className="dzd-facts">
            {bankRows.map(([k, v]) => (
              <div className="dzd-fact" key={k}>
                <div className="dzd-factk">{k}</div>
                <div className="dzd-factv">{v}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {fields.terms && (
        <>
          <div className="dzd-sec">Terms</div>
          <div className="dzd-notev">{fields.terms}</div>
        </>
      )}
    </article>
  );
}

function Meta({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <div className="dzd-metarow">
      <span className="dzd-metak">{k}</span>
      <span className="dzd-metav">{v}</span>
    </div>
  );
}
