/**
 * ExhibitionComposePage — `/admin/sources/:id/exhibitions/:eventId`, the
 * desk half of Exhibition Services ("Darz composes, the portal records" —
 * the old §78 split): the source's request on the left of the ledger, the
 * priced package under Darz's hand, and the documents that come out of it.
 *
 * One page, four moves, in the order the work happens:
 *   1 · read the request (gallery-owned facts + ticks, read-only here);
 *   2 · COMPOSE the package — the lines editor (seeded from the ticks with
 *       catalogue prices, never empty on a request), price/status/note per
 *       line, currency + discount; "Save" composes, "Approve" composes with
 *       `approve: true` (the gate `set_published` requires);
 *   3 · PUBLISH to the portal — the switch the partner's Exhibitions tab
 *       reads;
 *   4 · ISSUE the documents — proposal / invoice with a one-click
 *       create → render (client-side PDF, the backend's own contract) →
 *       upload → confirm chain, the reference following doc-reference.js
 *       (per-series per-year, saved with the document forever).
 *
 * `compose` REPLACES all lines server-side, so the editor always writes the
 * whole package — there is no per-line PATCH to drift against.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type {
  DocumentAdmin,
  ExhibitionAdmin,
  GalleryLinkAdmin,
  PortalCatalogueEntry,
} from '../../api/types';
import { ConfirmDialog, DeskBanner, DeskPage } from './kit';
import {
  DOC_SERIES,
  buildDocumentFields,
  draftFromCatalogue,
  lineTotals,
  money,
  nextReference,
  seedLines,
  toLineInputs,
  type BankDetails,
  type ExhibitionDocKind,
  type LineDraft,
} from './exhibitionForm';
import { choices, choiceLabel, fmtDate } from '../portal/portalForm';
import './admin.css';

const BANK_KEY = 'darz_desk_bank_details'; // per-device convenience; the record is Document.fields

export function ExhibitionComposePage() {
  const { id: linkId = '', eventId = '' } = useParams();
  const { galleryAdmin, documentsAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();

  const [ev, setEv] = useState<ExhibitionAdmin | null>(null);
  const [link, setLink] = useState<GalleryLinkAdmin | null>(null);
  const [catalogue, setCatalogue] = useState<PortalCatalogueEntry[]>([]);
  const [docs, setDocs] = useState<DocumentAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // the editor state — seeded once per loaded event version
  const [lines, setLines] = useState<LineDraft[] | null>(null);
  const [currency, setCurrency] = useState('');
  const [discount, setDiscount] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [issuing, setIssuing] = useState<ExhibitionDocKind | null>(null);
  const [unpublishAsk, setUnpublishAsk] = useState(false);

  const currencies = choices(options, 'currency');
  const lineStatuses = choices(options, 'gallery.exhibition_line_status');

  const load = useCallback(async () => {
    try {
      const [event, docsPage] = await Promise.all([
        galleryAdmin.exhibition(eventId),
        galleryAdmin.exhibitionDocuments(eventId),
      ]);
      setEv(event);
      setDocs(docsPage.results);
      setCurrency(event.currency || 'TMN');
      setDiscount(event.discount || '');
      setAdminNote(event.admin_note || '');
      galleryAdmin.link(event.link).then(setLink, () => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the exhibition.');
    }
  }, [galleryAdmin, eventId]);
  useEffect(() => {
    void load();
  }, [load]);

  // The services menu the desk offers = `gallery.exhibition_service` from
  // /api/options/ — {value,label} pairs only. The FULL catalogue (default
  // prices + descriptions) is served solely through the token+PIN portal
  // endpoint, so the desk seeds unpriced, description-less drafts and the
  // admin types both — pricing IS the desk's job ("Darz prices"), and the
  // missing admin catalogue endpoint is recorded as G-PORT-12.
  useEffect(() => {
    const svc = choices(options, 'gallery.exhibition_service');
    setCatalogue(
      svc.map((c) => ({ key: c.value, title: c.label, description: '', default_price: null })),
    );
  }, [options]);

  // seed the editor whenever a fresh event arrives
  useEffect(() => {
    if (ev) setLines(seedLines(ev, catalogue));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev?.id, ev?.version, catalogue.length]);

  const totals = useMemo(
    () =>
      lines ? lineTotals(lines, discount) : { sub: 0, disc: 0, tot: 0, count: 0, unpriced: 0 },
    [lines, discount],
  );

  const act = async (fn: () => Promise<void>, done?: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (done) setNotice(done);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not go through.');
    } finally {
      setBusy(false);
    }
  };

  const compose = (approve: boolean) =>
    act(
      async () => {
        if (!lines) return;
        const next = await galleryAdmin.composeExhibition(eventId, {
          lines: toLineInputs(lines),
          approve,
          currency,
          discount,
          admin_note: adminNote,
        });
        setEv(next);
      },
      approve ? 'Package approved — you can publish it to the portal.' : 'Package saved.',
    );

  const setPublished = (published: boolean) =>
    act(
      async () => {
        const next = await galleryAdmin.publishExhibition(eventId, published);
        setEv(next);
      },
      published ? 'Published — the partner sees the package now.' : 'Hidden from the portal.',
    );

  if (!ev || !lines) {
    return (
      <DeskPage title="Exhibition">
        {error ? <DeskBanner>{error}</DeskBanner> : <p className="dz-state">Loading…</p>}
      </DeskPage>
    );
  }

  const partner = link?.name ?? 'the partner';
  const dirty =
    JSON.stringify(toLineInputs(lines)) !==
      JSON.stringify(toLineInputs(seedLines(ev, catalogue))) ||
    currency !== (ev.currency || 'TMN') ||
    discount !== (ev.discount || '') ||
    adminNote !== (ev.admin_note || '');

  return (
    <DeskPage
      title={ev.title || 'Untitled show'}
      action={
        <span
          className={`ad-stpill is-${ev.request_status === 'approved' ? 'ok' : ev.request_status === 'rejected' ? 'gone' : ev.request_status === 'requested' ? 'res' : 'neut'}`}
        >
          {choiceLabel(options, 'gallery.exhibition_request_status', ev.request_status)}
        </span>
      }
    >
      <p className="ad-desksub">
        <button
          type="button"
          className="ad-ghostbtn"
          onClick={() => navigate(`/admin/sources/${linkId || ev.link}`)}
        >
          ← {partner}
        </button>{' '}
        ·{' '}
        {[ev.event_date, ev.venue, ev.artists].filter(Boolean).join(' · ') || 'no details yet'}
        {ev.gallery_updated_at
          ? ` · gallery last edited ${fmtDate(ev.gallery_updated_at)}`
          : ''}
      </p>

      {error && <DeskBanner>{error}</DeskBanner>}
      {notice && (
        <div className="ad-remind">
          <span>{notice}</span>
        </div>
      )}

      {/* ---- 1 · the request, as the source wrote it ---- */}
      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">The request</h2>
          <span className="ad-dsec-n">gallery-owned — edited from the portal, read here</span>
        </div>
        <div className="ad-card ad-logins">
          {ev.gallery_note && <p className="ad-exhnote">“{ev.gallery_note}”</p>}
          <p className="ad-exhticks">
            {ev.gallery_selected.length
              ? `Ticked: ${ev.gallery_selected
                  .map((k) => choiceLabel(options, 'gallery.exhibition_service', k))
                  .join(' · ')}`
              : 'No services ticked yet.'}
          </p>
        </div>
      </section>

      {/* ---- 2 · the priced package ---- */}
      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">The package</h2>
          <span className="ad-dsec-n">Darz prices; a declined line never counts</span>
        </div>

        <div className="ad-card">
          {lines.map((l, i) => (
            <div className="ad-exhline" key={`${l.service_key}-${i}`}>
              <div className="ad-exhline-main">
                <input
                  aria-label="Service title"
                  value={l.title}
                  onChange={(e) => setLines(patchLine(lines, i, { title: e.target.value }))}
                />
                <textarea
                  aria-label="Service description"
                  rows={1}
                  placeholder="One line on what this covers…"
                  value={l.description}
                  onChange={(e) =>
                    setLines(patchLine(lines, i, { description: e.target.value }))
                  }
                />
              </div>
              <div className="ad-exhline-side">
                <input
                  className="ad-exhline-price"
                  aria-label="Price"
                  inputMode="decimal"
                  placeholder="Price"
                  value={l.price}
                  onChange={(e) => setLines(patchLine(lines, i, { price: e.target.value }))}
                />
                <select
                  aria-label="Line currency"
                  value={l.currency}
                  onChange={(e) => setLines(patchLine(lines, i, { currency: e.target.value }))}
                >
                  {currencies.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.value}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Line status"
                  value={l.status}
                  onChange={(e) =>
                    setLines(
                      patchLine(lines, i, { status: e.target.value as LineDraft['status'] }),
                    )
                  }
                >
                  {lineStatuses.map((sOpt) => (
                    <option key={sOpt.value} value={sOpt.value}>
                      {sOpt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ad-rowbtn is-danger"
                  onClick={() => setLines(lines.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {lines.length === 0 && (
            <p className="dz-state">No lines yet — add from the menu below.</p>
          )}

          <div className="ad-exhadd">
            {catalogue
              .filter((c) => !lines.some((l) => l.service_key === c.key))
              .map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className="ad-rowbtn"
                  onClick={() => setLines([...lines, draftFromCatalogue(c, currency)])}
                >
                  ＋ {c.title}
                </button>
              ))}
            <button
              type="button"
              className="ad-rowbtn"
              onClick={() =>
                setLines([
                  ...lines,
                  {
                    service_key: '',
                    title: 'Custom service',
                    description: '',
                    price: '',
                    currency,
                    status: 'proposed',
                    admin_note: '',
                  },
                ])
              }
            >
              ＋ Custom line
            </button>
          </div>
        </div>

        <div className="ad-card ad-exhfoot">
          <label className="ad-filter">
            <span className="ad-filter-l">Currency</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ad-filter">
            <span className="ad-filter-l">Discount</span>
            <input
              inputMode="decimal"
              placeholder="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </label>
          <label className="ad-filter ad-exhnotein">
            <span className="ad-filter-l">Internal note</span>
            <input
              placeholder="Only the desk sees this"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
          </label>
          <span className="ad-exhtotal">
            {totals.count} line{totals.count === 1 ? '' : 's'}
            {totals.unpriced ? ` · ${totals.unpriced} unpriced` : ''}
            {totals.disc ? ` · −${money(currency, totals.disc)}` : ''} ·{' '}
            <b>{money(currency, totals.tot)}</b>
          </span>
        </div>

        <div className="ad-rowacts ad-exhacts">
          <button
            type="button"
            className="ad-rowbtn"
            disabled={busy}
            onClick={() => void compose(false)}
          >
            Save package
          </button>
          <button
            type="button"
            className="ad-action"
            disabled={busy}
            onClick={() => void compose(true)}
            title="Compose and mark the request approved — the publish gate"
          >
            {ev.request_status === 'approved' ? 'Save & keep approved' : 'Approve package'}
          </button>
          {dirty && <span className="ad-cellsub">unsaved changes</span>}
        </div>
      </section>

      {/* ---- 3 · the portal switch ---- */}
      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">On the portal</h2>
          <span className="ad-dsec-n">
            hide-only, never deletes — the partner's Exhibitions tab
          </span>
        </div>
        <div className="ad-card ad-reach">
          <label className="ad-actck">
            <input
              type="checkbox"
              checked={ev.published}
              disabled={busy || (!ev.published && ev.request_status !== 'approved')}
              onChange={(e) => {
                if (!e.target.checked) setUnpublishAsk(true);
                else void setPublished(true);
              }}
            />
            {ev.published
              ? 'Published — the partner sees this show, its package and its documents.'
              : ev.request_status === 'approved'
                ? 'Publish to the portal'
                : 'Publish to the portal (approve the package first)'}
          </label>
        </div>
      </section>

      {/* ---- 4 · the documents ---- */}
      <DocumentsSection
        ev={ev}
        docs={docs}
        busy={busy}
        onIssue={(kind) => setIssuing(kind)}
        onChanged={() => void load()}
        act={act}
        galleryAdmin={galleryAdmin}
      />

      {issuing && (
        <IssueDocumentDialog
          kind={issuing}
          ev={ev}
          partner={partner}
          lines={lines}
          docs={docs ?? []}
          onClose={() => setIssuing(null)}
          onDone={() => {
            setIssuing(null);
            void load();
          }}
          galleryAdmin={galleryAdmin}
          documentsAdmin={documentsAdmin}
        />
      )}

      {unpublishAsk && (
        <ConfirmDialog
          message="Hide this show from the portal? The partner stops seeing the package and its documents until you publish again — nothing is deleted."
          okLabel="Hide it"
          onConfirm={() => {
            setUnpublishAsk(false);
            void setPublished(false);
          }}
          onCancel={() => setUnpublishAsk(false)}
        />
      )}
    </DeskPage>
  );
}

function patchLine(lines: LineDraft[], i: number, patch: Partial<LineDraft>): LineDraft[] {
  return lines.map((l, j) => (j === i ? { ...l, ...patch } : l));
}

/* ── documents ──────────────────────────────────────────────────────────── */

interface ActFn {
  (fn: () => Promise<void>, done?: string): Promise<void>;
}

function DocumentsSection({
  ev,
  docs,
  busy,
  onIssue,
  onChanged,
  act,
  galleryAdmin,
}: {
  ev: ExhibitionAdmin;
  docs: DocumentAdmin[] | null;
  busy: boolean;
  onIssue: (kind: ExhibitionDocKind) => void;
  onChanged: () => void;
  act: ActFn;
  galleryAdmin: ReturnType<typeof useApi>['galleryAdmin'];
}) {
  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Documents</h2>
        <span className="ad-dsec-n">
          created, rendered and issued in one step — the portal sees a confirmed document once
          the show is published
        </span>
      </div>

      {docs === null && <p className="dz-state">Loading…</p>}
      {docs && docs.length === 0 && (
        <p className="dz-state">
          No documents yet — issue the proposal once the package stands.
        </p>
      )}
      {docs &&
        docs.map((d) => {
          const f = (d.fields ?? {}) as Record<string, unknown>;
          const stamped = !!(f.portal_accepted_at || f.portal_signed_at);
          const stampedBy = String(f.portal_accepted_by ?? f.portal_signed_by ?? '');
          return (
            <div className="ad-card ad-updrow" key={d.id}>
              <div className="ad-updmain">
                <span className="ad-cellmain">
                  {d.title}{' '}
                  {f.reference ? (
                    <span className="ad-cellsub">· {String(f.reference)}</span>
                  ) : null}
                </span>
                <span className="ad-cellsub">
                  {d.status}
                  {d.signed_at ? ' · signed by Darz' : ''}
                  {stamped
                    ? ` · ${d.kind === 'exhibition_proposal' ? 'accepted' : 'signed'} by the partner${stampedBy ? ` (${stampedBy})` : ''}`
                    : ''}
                </span>
              </div>
              <span className="ad-rowacts">
                {d.pdf_url && (
                  <a
                    className="ad-rowbtn"
                    href={d.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open PDF
                  </a>
                )}
                {d.status === 'confirmed' &&
                  d.kind === 'exhibition_invoice' &&
                  !d.signed_at && (
                    <button
                      type="button"
                      className="ad-rowbtn"
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          await galleryAdmin.signExhibitionDocument(ev.id, d.id);
                          onChanged();
                        }, 'Signed for Darz.')
                      }
                    >
                      Sign for Darz
                    </button>
                  )}
              </span>
            </div>
          );
        })}

      <div className="ad-rowacts ad-exhacts">
        <button
          type="button"
          className="ad-action"
          disabled={busy}
          onClick={() => onIssue('exhibition_proposal')}
        >
          Issue a proposal
        </button>
        <button
          type="button"
          className="ad-rowbtn"
          disabled={busy}
          onClick={() => onIssue('exhibition_invoice')}
        >
          Issue an invoice
        </button>
      </div>
    </section>
  );
}

/**
 * The one-click issue chain: reference (doc-reference rule, prefilled from
 * the highest already saved), note/terms (+ bank block on invoices,
 * remembered per device), then create → render → upload → confirm without
 * further clicks. The document snapshot never re-derives (rule 1).
 */
function IssueDocumentDialog({
  kind,
  ev,
  partner,
  lines,
  docs,
  onClose,
  onDone,
  galleryAdmin,
  documentsAdmin,
}: {
  kind: ExhibitionDocKind;
  ev: ExhibitionAdmin;
  partner: string;
  lines: LineDraft[];
  docs: DocumentAdmin[];
  onClose: () => void;
  onDone: () => void;
  galleryAdmin: ReturnType<typeof useApi>['galleryAdmin'];
  documentsAdmin: ReturnType<typeof useApi>['documentsAdmin'];
}) {
  const series = DOC_SERIES[kind];
  const year = new Date().getFullYear();
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [terms, setTerms] = useState('');
  // the bank block: per-device convenience, read once at mount (the RECORD
  // is what lands in Document.fields)
  const [bank, setBank] = useState<BankDetails>(() => {
    if (kind !== 'exhibition_invoice') return { holder: '', bank: '', card: '', iban: '' };
    try {
      const parsed = JSON.parse(
        localStorage.getItem(BANK_KEY) ?? '{}',
      ) as Partial<BankDetails>;
      return {
        holder: parsed.holder ?? '',
        bank: parsed.bank ?? '',
        card: parsed.card ?? '',
        iban: parsed.iban ?? '',
      };
    } catch {
      return { holder: '', bank: '', card: '', iban: '' };
    }
  });
  const [step, setStep] = useState<'form' | 'working' | 'error'>('form');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  // prefill the reference from EVERY stored document of this kind (rule 4:
  // highest seen), and the bank block from this device's last invoice
  useEffect(() => {
    let alive = true;
    const refOf = (d: DocumentAdmin) =>
      ((d.fields ?? {}) as Record<string, unknown>).reference as string | undefined;
    documentsAdmin.documents({ kind, per_page: 200 }).then(
      (p) => alive && setReference(nextReference(p.results.map(refOf), series.code, year)),
      // the library being unreachable never blocks issuing — fall back to
      // this event's own documents (a lower floor, still monotonic here)
      () => alive && setReference(nextReference(docs.map(refOf), series.code, year)),
    );
    return () => {
      alive = false;
    };
  }, [documentsAdmin, kind, series.code, year, docs]);

  const issue = async () => {
    setStep('working');
    setError('');
    try {
      const fields = buildDocumentFields(kind, ev, partner, lines, {
        reference,
        note,
        terms,
        bank: kind === 'exhibition_invoice' ? bank : undefined,
      });
      setProgress('Creating the document…');
      const doc = await galleryAdmin.createExhibitionDocument(ev.id, {
        doc_type: kind,
        title: `${ev.title} — ${kind === 'exhibition_proposal' ? 'Proposal' : 'Invoice'}`,
        fields,
      });
      setProgress('Rendering the PDF…');
      const { renderDocumentPdf } = await import('./pdf/renderPdf');
      const blob = await renderDocumentPdf(kind, fields);
      setProgress('Uploading…');
      await galleryAdmin.uploadExhibitionDocumentPdf(ev.id, doc.id, blob, `${reference}.pdf`);
      setProgress('Confirming (issuing)…');
      await galleryAdmin.confirmExhibitionDocument(ev.id, doc.id);
      if (kind === 'exhibition_invoice') {
        try {
          localStorage.setItem(BANK_KEY, JSON.stringify(bank));
        } catch {
          /* convenience only */
        }
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The issue chain failed.');
      setStep('error');
    }
  };

  return (
    <div className="ad-modal">
      <div className="ad-modalcard ad-issuecard">
        <h3 className="ad-modaltitle">
          {kind === 'exhibition_proposal' ? 'Issue the proposal' : 'Issue the invoice'}
        </h3>
        <p className="ad-cellsub">
          Snapshot of the package as it stands —{' '}
          {lines.filter((l) => l.status !== 'declined').length} line(s). Created, rendered and
          confirmed in one go; publish the show so the partner sees it.
        </p>

        {step !== 'working' ? (
          <>
            <label className="ad-field">
              <span>{series.label} reference</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} />
            </label>
            <label className="ad-field">
              <span>Note from Darz</span>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional — prints on the document"
              />
            </label>
            <label className="ad-field">
              <span>Terms</span>
              <textarea
                rows={2}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Optional"
              />
            </label>
            {kind === 'exhibition_invoice' && (
              <div className="ad-bankgrid">
                <label className="ad-field">
                  <span>Account holder</span>
                  <input
                    value={bank.holder}
                    onChange={(e) => setBank({ ...bank, holder: e.target.value })}
                  />
                </label>
                <label className="ad-field">
                  <span>Bank</span>
                  <input
                    value={bank.bank}
                    onChange={(e) => setBank({ ...bank, bank: e.target.value })}
                  />
                </label>
                <label className="ad-field">
                  <span>Card no.</span>
                  <input
                    value={bank.card}
                    onChange={(e) => setBank({ ...bank, card: e.target.value })}
                  />
                </label>
                <label className="ad-field">
                  <span>Sheba (IBAN)</span>
                  <input
                    value={bank.iban}
                    onChange={(e) => setBank({ ...bank, iban: e.target.value })}
                  />
                </label>
              </div>
            )}
            {error && <DeskBanner>{error}</DeskBanner>}
            <div className="ad-rowacts ad-exhacts">
              <button
                type="button"
                className="ad-action"
                onClick={() => void issue()}
                disabled={!reference.trim()}
              >
                Create &amp; issue
              </button>
              <button type="button" className="ad-rowbtn" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <p className="dz-state">{progress}</p>
        )}
      </div>
    </div>
  );
}
