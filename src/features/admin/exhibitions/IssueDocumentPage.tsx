/**
 * IssueDocumentPage — `/admin/issue`, and `/admin/issue/:eventId` to arrive
 * with the show already chosen.
 *
 * One page, from an empty desk to a PDF in the client's hands. The old path
 * was: open the partner, open the show, read the request, price the lines,
 * save, approve, publish, then open a modal per document kind and type the
 * reference, the note and the terms again. The owner asked for one screen, so:
 *
 *   ① the exhibition — picking it fills the client, the dates and the venue
 *   ② proposal or invoice — the reference numbers itself
 *   ③ the services — from the library, price and description already filled
 *   ④ quantity, price, discount, note, terms (and the bank block on an invoice)
 *   ⑤ the preview, always on screen, beside "Open the PDF" for the real file
 *   ⑥ one button — saves the document, renders the PDF, files it in history
 *
 * The preview and the PDF are built from ONE `fields` object
 * (`buildIssueFields`), so what is on screen and what the client opens cannot
 * say different things; `DocumentPreview` explains why the pane is an HTML
 * twin rather than the PDF in an iframe.
 *
 * Issuing keeps the chain the desk already had — create → render → upload →
 * confirm — because that is the backend's contract, and a document that is
 * created but not confirmed is a draft the portal will not show.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi, useOptions } from '../../../api/hooks';
import type {
  DocumentAdmin,
  ExhibitionAdmin,
  GalleryLinkAdmin,
  PackageTemplateAdmin,
  ServiceCatalogItemAdmin,
} from '../../../api/types';
import { DeskBanner, DeskPage } from '../kit';
import { DocumentPreview } from './DocumentPreview';
import { SERIES_KINDS, type BankDetails, type ExhibitionDocKind } from '../exhibitionForm';
import { choiceLabel } from '../../portal/portalForm';
import {
  blankLine,
  buildIssueFields,
  group,
  issueTotals,
  lineAmount,
  num,
  referenceFrom,
  toWireLines,
  whyNotReady,
  type IssueLine,
} from './issueForm';
import {
  libraryCurrency,
  search,
  toLibrary,
  toPackages,
  withQuantities,
  type LibraryPackage,
  type LibraryService,
} from './servicesLibrary';
import { hasBank, newestBank, readLocalBank, saveLocalBank } from './bankDetails';
import { walkPages } from '../../../api/paging';
import './exhibitions.css';

export function IssueDocumentPage() {
  const { eventId: fromUrl } = useParams();
  const { galleryAdmin, documentsAdmin, projectsAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();

  // ── what the page is built from
  const [shows, setShows] = useState<ExhibitionAdmin[] | null>(null);
  const [partners, setPartners] = useState<Map<string, GalleryLinkAdmin>>(new Map());
  const [rows, setRows] = useState<ServiceCatalogItemAdmin[] | null>(null);
  const [packageRows, setPackageRows] = useState<PackageTemplateAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── the draft
  const [eventId, setEventId] = useState(fromUrl ?? '');
  const [kind, setKind] = useState<ExhibitionDocKind>('exhibition_proposal');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<IssueLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [note, setNote] = useState('');
  const [terms, setTerms] = useState('');
  /* TD-3. The block starts from this device's copy so the page is instant,
     then the server's own last-issued invoice overwrites it — see
     `bankDetails.ts` for why the audit's `theme.*` suggestion is the one
     answer this must NOT take (that endpoint is `AllowAny`). */
  const [bank, setBank] = useState<BankDetails>(readLocalBank);
  const [bankTouched, setBankTouched] = useState(false);
  useEffect(() => {
    let alive = true;
    documentsAdmin.documents({ kind: 'exhibition_invoice', per_page: 20 }).then(
      (page) => {
        const found = newestBank(page.results);
        // Never clobber what the admin has typed. The seed is a starting
        // point, not a correction — an edit mid-form must survive the read
        // landing late.
        if (alive && found && !bankTouched) setBank(found);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
    // `bankTouched` is read, not depended on: re-running this when the admin
    // starts typing is exactly what must not happen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentsAdmin]);
  const [picking, setPicking] = useState(false);
  /** The show the lines were filled from. A ref, not state: remembering it
   * must not itself cause a render (oxlint react/set-state-in-effect). */
  const seededFor = useRef('');

  // ── issuing
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [issued, setIssued] = useState<DocumentAdmin | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const library = useMemo(() => toLibrary(rows ?? []), [rows]);
  const packages = useMemo(
    () => toPackages(packageRows ?? [], library),
    [packageRows, library],
  );
  const show = useMemo(
    () => (shows ?? []).find((s) => s.id === eventId) ?? null,
    [shows, eventId],
  );
  const partnerName = show ? (partners.get(show.link)?.name ?? '') : '';
  const currency = show?.currency || libraryCurrency(library, 'TMN');
  const currencyLabel = choiceLabel(options, 'currency', currency) || currency;

  /**
   * ① Picking a show fills the document from what is already recorded: the
   * lines Darz has already priced, else the services the gallery ticked, with
   * each one's price and description from the library.
   *
   * Called from the select and from the first load when the page was opened
   * at `/admin/issue/:eventId` — never from an effect that watches state,
   * which is how a form starts fighting the person typing in it.
   */
  const fillFrom = useCallback(
    (ev: ExhibitionAdmin, lib: LibraryService[]) => {
      seededFor.current = ev.id;
      setDiscount(ev.discount || '');
      const composed = ev.service_lines ?? [];
      if (composed.length) {
        setLines(
          composed.map((l) => ({
            key: l.service_key,
            title: l.title,
            description: l.description,
            qty: '1',
            unitPrice: l.price === null || l.price === '' ? '' : String(num(String(l.price))),
          })),
        );
        return;
      }
      const byName = new Map(lib.map((s) => [s.name.toLowerCase(), s] as const));
      setLines(
        ((ev.gallery_selected ?? []) as string[]).map((key) => {
          const label = choiceLabel(options, 'gallery.exhibition_service', key) || key;
          const hit = byName.get(label.toLowerCase());
          return {
            key,
            title: hit?.name ?? label,
            description: hit?.description ?? '',
            qty: '1',
            unitPrice:
              hit?.price === null || hit?.price === undefined ? '' : String(hit.price),
          };
        }),
      );
    },
    [options],
  );

  // ② the reference numbers itself, across every kind sharing the series
  useEffect(() => {
    let alive = true;
    Promise.all(
      (SERIES_KINDS[kind === 'exhibition_proposal' ? 'PRO' : 'SINV'] ?? [kind]).map((k) =>
        // Walked whole: the next number needs every issued document of the
        // series, and `per_page` is clamped to 100 (C-5).
        walkPages((page) => documentsAdmin.documents({ kind: k, page, per_page: 100 })),
      ),
    ).then(
      (lists) => {
        if (!alive) return;
        const all = lists.flat();
        setReference(referenceFrom(all, kind, new Date().getFullYear()));
      },
      () => alive && setReference(referenceFrom([], kind, new Date().getFullYear())),
    );
    return () => {
      alive = false;
    };
  }, [documentsAdmin, kind]);

  useEffect(() => {
    Promise.all([
      walkPages((page) => galleryAdmin.exhibitions({ page, per_page: 100 })),
      walkPages((page) => galleryAdmin.links({ page, per_page: 100 })),
      walkPages((page) => projectsAdmin.services({ page, per_page: 100 })),
      walkPages((page) => projectsAdmin.packages({ page, per_page: 100 })),
    ]).then(
      ([evs, links, svcs, pkgs]) => {
        setShows(evs);
        setPartners(new Map(links.map((l) => [l.id, l])));
        setRows(svcs);
        setPackageRows(pkgs);
        // opened at /admin/issue/:eventId — fill it here, inside the load's
        // own chain, rather than from an effect watching what it just set
        const opened = fromUrl ? evs.find((e) => e.id === fromUrl) : undefined;
        if (opened) fillFrom(opened, toLibrary(svcs));
      },
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the desk.'),
    );
  }, [galleryAdmin, projectsAdmin, fromUrl, fillFrom]);

  const totals = issueTotals(lines, discount);
  const fields = useMemo(
    () =>
      show
        ? buildIssueFields(show, partnerName, {
            kind,
            reference,
            lines,
            currency,
            discount,
            note,
            terms,
            bank: kind === 'exhibition_invoice' ? bank : undefined,
            issuedAt: new Date().toISOString().slice(0, 10),
          })
        : null,
    [show, partnerName, kind, reference, lines, currency, discount, note, terms, bank],
  );
  const blocked = whyNotReady(eventId, { reference, lines });

  const patch = (i: number, next: Partial<IssueLine>) =>
    setLines(lines.map((l, j) => (j === i ? { ...l, ...next } : l)));

  const addService = (s: LibraryService, qty = 1) =>
    setLines((cur) => [
      ...cur,
      {
        key: '',
        title: s.name,
        description: s.description,
        qty: String(qty),
        unitPrice: s.price === null ? '' : String(s.price),
      },
    ]);

  const addPackage = (p: LibraryPackage) =>
    setLines((cur) => [
      ...cur,
      ...withQuantities(p.services).map((o) => ({
        key: '',
        title: o.service.name,
        description: o.service.description,
        qty: String(o.qty),
        unitPrice: o.service.price === null ? '' : String(o.service.price),
      })),
    ]);

  /** The real file, on demand: the preview beside it is a twin built from the
   * same `fields`, and this is the literal artefact for the last look. */
  const openPdf = async () => {
    if (!fields || pdfBusy) return;
    setPdfBusy(true);
    try {
      const { renderDocumentPdf } = await import('../pdf/renderPdf');
      const blob = await renderDocumentPdf(kind, fields);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      // the tab holds its own reference; release ours once it has loaded
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The PDF could not be drawn.');
    } finally {
      setPdfBusy(false);
    }
  };

  // ⑥ the one button: the package is saved first (so the gallery's portal and
  // the document agree), then create → render → upload → confirm.
  const issue = async () => {
    if (!show || !fields || busy) return;
    setBusy(true);
    setError(null);
    try {
      setProgress('Saving the package…');
      await galleryAdmin.composeExhibition(show.id, {
        lines: toWireLines(lines, currency),
        approve: true,
        currency,
        discount: discount.trim() === '' ? '' : String(num(discount)),
        admin_note: show.admin_note ?? '',
      });
      setProgress('Creating the document…');
      const doc = await galleryAdmin.createExhibitionDocument(show.id, {
        doc_type: kind,
        title: `${show.title} — ${kind === 'exhibition_proposal' ? 'Proposal' : 'Invoice'}`,
        fields,
      });
      setProgress('Rendering the PDF…');
      const { renderDocumentPdf } = await import('../pdf/renderPdf');
      const blob = await renderDocumentPdf(kind, fields);
      setProgress('Filing it…');
      await galleryAdmin.uploadExhibitionDocumentPdf(
        show.id,
        doc.id,
        blob,
        `${reference}.pdf`,
      );
      const confirmed = await galleryAdmin.confirmExhibitionDocument(show.id, doc.id);
      // The server copy is `fields.bank` on the document just issued; this is
      // only the device's head start next time.
      if (kind === 'exhibition_invoice' && hasBank(bank)) saveLocalBank(bank);
      setIssued(confirmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The document was not issued.');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  if (issued && show) {
    return (
      <DeskPage title="Issued">
        <div className="dzx-done">
          <div className="dzx-donet">{reference}</div>
          <p>
            {kind === 'exhibition_proposal' ? 'The proposal' : 'The invoice'} for{' '}
            <b>{show.title}</b> is issued and filed. {partnerName} sees it in their portal once
            the show is published.
          </p>
          <div className="ad-rowacts">
            {issued.pdf_url && (
              <a
                className="ad-rowbtn is-primary"
                href={issued.pdf_url}
                target="_blank"
                rel="noreferrer"
              >
                Open the PDF
              </a>
            )}
            <button
              type="button"
              className="ad-rowbtn"
              onClick={() => navigate(`/admin/sources/${show.link}/exhibitions/${show.id}`)}
            >
              Open the show
            </button>
            <button
              type="button"
              className="ad-rowbtn"
              onClick={() => {
                setIssued(null);
                setKind(
                  kind === 'exhibition_proposal'
                    ? 'exhibition_invoice'
                    : 'exhibition_proposal',
                );
              }}
            >
              Issue the {kind === 'exhibition_proposal' ? 'invoice' : 'proposal'} too
            </button>
          </div>
        </div>
      </DeskPage>
    );
  }

  return (
    <DeskPage
      title="Issue a document"
      subtitle={
        <>
          One page: choose the show, pick the services, see exactly what the client receives,
          and issue it.
        </>
      }
    >
      {error && <DeskBanner>{error}</DeskBanner>}

      <div className="dzx-split">
        <div className="dzx-form">
          {/* ① */}
          <Step n={1} title="Exhibition">
            <select
              className="dzx-input"
              aria-label="Exhibition"
              value={eventId}
              onChange={(e) => {
                const next = e.target.value;
                setEventId(next);
                const picked = (shows ?? []).find((x) => x.id === next);
                if (picked && seededFor.current !== next) fillFrom(picked, library);
              }}
            >
              <option value="">Choose an exhibition…</option>
              {(shows ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {partners.get(s.link)?.name ?? 'Partner'} — {s.title}
                </option>
              ))}
            </select>
            {show && (
              <div className="dzx-facts">
                {[
                  ['Client', partnerName],
                  ['Dates', show.event_date],
                  ['Space', show.venue],
                  ['Artists', show.artists],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <span className="dzx-mut">{k}</span> {v}
                    </div>
                  ))}
              </div>
            )}
            {!shows && !error && <p className="dz-state">Loading…</p>}
          </Step>

          {/* ② */}
          <Step n={2} title="Document">
            <div className="dzx-kinds">
              {(
                [
                  ['exhibition_proposal', 'Proposal'],
                  ['exhibition_invoice', 'Invoice'],
                ] as Array<[ExhibitionDocKind, string]>
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={`dzx-kind${kind === k ? ' is-on' : ''}`}
                  onClick={() => setKind(k)}
                >
                  {label}
                </button>
              ))}
              <input
                className="dzx-input dzx-ref"
                aria-label="Reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </Step>

          {/* ③ + ④ */}
          <Step n={3} title="Services">
            {lines.length === 0 && (
              <p className="dz-state">Nothing on it yet — add a service below.</p>
            )}
            {lines.map((l, i) => (
              <div className="dzx-line" key={i}>
                <input
                  className="dzx-input dzx-t"
                  aria-label="Service"
                  placeholder="What it is"
                  value={l.title}
                  onChange={(e) => patch(i, { title: e.target.value })}
                />
                <input
                  className="dzx-input dzx-qty"
                  aria-label="Quantity"
                  inputMode="numeric"
                  value={l.qty}
                  onChange={(e) => patch(i, { qty: e.target.value })}
                />
                <input
                  className="dzx-input dzx-price"
                  aria-label="Unit price"
                  inputMode="numeric"
                  placeholder="Quoted later"
                  value={l.unitPrice}
                  onChange={(e) => patch(i, { unitPrice: e.target.value })}
                />
                <div className="dzx-lineamt">
                  {l.unitPrice.trim() === '' ? '—' : group(lineAmount(l))}
                </div>
                <button
                  type="button"
                  className="ad-rowbtn is-danger dzx-x"
                  aria-label={`Remove ${l.title || 'line'}`}
                  onClick={() => setLines(lines.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
                <textarea
                  className="dzx-input dzx-desc"
                  aria-label="Description"
                  placeholder="One line on what this covers — it prints on the document"
                  rows={2}
                  value={l.description}
                  onChange={(e) => patch(i, { description: e.target.value })}
                />
              </div>
            ))}

            <div className="ad-rowacts">
              <button
                type="button"
                className="ad-rowbtn is-primary"
                onClick={() => setPicking(true)}
              >
                ＋ Add from the library
              </button>
              <button
                type="button"
                className="ad-rowbtn"
                onClick={() => setLines([...lines, blankLine()])}
              >
                ＋ Something else
              </button>
            </div>
          </Step>

          {/* ④ */}
          <Step n={4} title="Terms">
            <div className="dzx-grid">
              <label className="dzx-field">
                <span>Discount ({currencyLabel})</span>
                <input
                  className="dzx-input"
                  inputMode="numeric"
                  placeholder="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </label>
              <div className="dzx-sum">
                <div>
                  <span className="dzx-mut">Subtotal</span> {group(totals.subtotal)}
                </div>
                {totals.discount > 0 && (
                  <div>
                    <span className="dzx-mut">Discount</span> −{group(totals.discount)}
                  </div>
                )}
                <div className="dzx-total">
                  <span className="dzx-mut">Total</span> {group(totals.total)} {currency}
                </div>
                {totals.unpriced > 0 && (
                  <div className="dzx-mut">
                    {totals.unpriced} line{totals.unpriced === 1 ? '' : 's'} quoted later
                  </div>
                )}
              </div>
            </div>
            <label className="dzx-field">
              <span>Note from Darz</span>
              <textarea
                className="dzx-input"
                rows={2}
                placeholder="Optional — prints on the document"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <label className="dzx-field">
              <span>Payment terms</span>
              <textarea
                className="dzx-input"
                rows={2}
                placeholder="e.g. 50% on signing, 50% on delivery"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />
            </label>
            {kind === 'exhibition_invoice' && (
              <div className="dzx-grid">
                {(
                  [
                    ['holder', 'Account holder'],
                    ['bank', 'Bank'],
                    ['card', 'Card no.'],
                    ['iban', 'Sheba (IBAN)'],
                  ] as Array<[keyof BankDetails, string]>
                ).map(([k, label]) => (
                  <label className="dzx-field" key={k}>
                    <span>{label}</span>
                    <input
                      className="dzx-input"
                      value={bank[k]}
                      onChange={(e) => {
                        setBankTouched(true);
                        setBank({ ...bank, [k]: e.target.value });
                      }}
                    />
                  </label>
                ))}
              </div>
            )}
          </Step>

          {/* ⑥ */}
          <div className="dzx-issue">
            <button
              type="button"
              className="dzx-issuebtn"
              disabled={!!blocked || busy}
              onClick={() => void issue()}
            >
              {busy
                ? progress || 'Working…'
                : `Issue the ${kind === 'exhibition_proposal' ? 'proposal' : 'invoice'}`}
            </button>
            {blocked && <span className="dzx-mut">{blocked}</span>}
            {!blocked && !busy && (
              <span className="dzx-mut">
                Saves the package, renders the PDF and files it in this show’s documents.
              </span>
            )}
          </div>
        </div>

        {/* ⑤ */}
        <div className="dzx-preview">
          <div className="dzx-previewh">
            <span>Preview</span>
            {fields && (
              <button
                type="button"
                className="ad-rowbtn"
                disabled={pdfBusy}
                onClick={() => void openPdf()}
              >
                {pdfBusy ? 'Drawing…' : 'Open the PDF'}
              </button>
            )}
          </div>
          <div className="dzx-paper">
            {fields ? (
              <DocumentPreview fields={fields} />
            ) : (
              <p className="dz-state">Choose an exhibition to see the document.</p>
            )}
          </div>
        </div>
      </div>

      {picking && (
        <LibraryPicker
          services={library}
          packages={packages}
          currency={currency}
          onAddService={(s) => addService(s)}
          onAddPackage={addPackage}
          onClose={() => setPicking(false)}
        />
      )}
    </DeskPage>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dzx-step">
      <div className="dzx-steph">
        <span className="dzx-stepn">{n}</span>
        <h2 className="dzx-stept">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/** The library, as a picker: search, click to add. A package adds every
 * service in it at once, which is the whole point of having packages. */
function LibraryPicker({
  services,
  packages,
  currency,
  onAddService,
  onAddPackage,
  onClose,
}: {
  services: LibraryService[];
  packages: LibraryPackage[];
  currency: string;
  onAddService: (s: LibraryService) => void;
  onAddPackage: (p: LibraryPackage) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const shown = search(services, query);
  return (
    <div className="ad-modal" role="dialog" aria-label="Exhibition Services library">
      <div className="ad-modalcard dzx-picker">
        <h3 className="ad-modaltitle">Exhibition Services</h3>
        <input
          className="dzx-input"
          aria-label="Find a service"
          placeholder="Find a service…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {packages.length > 0 && !query && (
          <>
            <div className="dzx-pickh">Packages</div>
            {packages.map((p) => (
              <button
                type="button"
                className="dzx-pick"
                key={p.id}
                onClick={() => {
                  onAddPackage(p);
                  onClose();
                }}
              >
                <span className="dzx-pickt">{p.name}</span>
                <span className="dzx-mut">
                  {p.services.length} service{p.services.length === 1 ? '' : 's'}
                </span>
              </button>
            ))}
          </>
        )}
        <div className="dzx-pickh">Services</div>
        {shown.length === 0 && <p className="dz-state">Nothing matches.</p>}
        {shown.map((s) => (
          <button
            type="button"
            className="dzx-pick"
            key={s.id}
            onClick={() => {
              onAddService(s);
              onClose();
            }}
          >
            <span className="dzx-pickt">
              {s.name}
              {s.description && <span className="dzx-mut"> — {s.description}</span>}
            </span>
            <span className="dzx-mut">
              {s.price === null
                ? 'quoted later'
                : `${group(s.price)} ${s.currency || currency}`}
            </span>
          </button>
        ))}
        <div className="ad-rowacts">
          <button type="button" className="ad-rowbtn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
