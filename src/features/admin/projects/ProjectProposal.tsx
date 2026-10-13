/**
 * ProjectProposal — the Proposal section of the project record
 * (`darz-studio.html:13848-13863`) and the project's Proposal + Invoice
 * builder over `/projects/admin/projects/{id}/documents/` (backend
 * 2026-10-01: `kind` project_proposal | project_invoice, `ref` = the
 * project's id, draft → confirmed → signed).
 *
 * Ported content:
 *  - the `.dzp-darz` "Client proposal" card (`:13851`): its sentence with the
 *    "Last saved · Draft|Final · date" / "Not created yet" status from the
 *    newest proposal, and its button "Preview & share proposal";
 *  - the old **proposal composer** (`proposal()` → `_propForm`,
 *    `:14027-14141`), inline on the record (the old detail had no second
 *    modal layer here): the "From the package · …" summary (`:14058`), the
 *    fields "Proposal title" · "Client name" · "Project / show" · "Short
 *    introduction" · "Notes / terms (optional — shown above the package
 *    terms)", the owner's Automatic / With pricing / Without pricing switch
 *    with its notes (`:14060-14064`; a standard admin reads the old owner-
 *    only line instead), the Draft / Final chip, and the footer's Save draft
 *    · Finalize · ↓ Download PDF · Preview with Cancel;
 *  - the document is the old composer's sections in the shared paper design
 *    (`projectDocs.ts`, `pdf/documentPdf.tsx`): Introduction, the services,
 *    Deliverables, Timeline, the Investment (when priced) and "Notes &
 *    terms" — notes first, then the package's terms.
 *
 * What the lifecycle does here:
 *  - **Save draft** creates the document (first time) or PATCHes its
 *    `fields` (the generic documents PATCH — draft-only server-side; there is
 *    no project-scoped one) — toast "Proposal draft saved" (`:14104`);
 *  - **Finalize** saves, renders the PDF client-side, uploads it and confirms
 *    — the backend refuses a confirm without a PDF — then "Proposal
 *    finalized & saved to the Library" (`:14105`). A failure after the save
 *    leaves the draft in the list; Finalize again resumes on the SAME
 *    document, so a reference is never issued twice;
 *  - **Preview** renders the PDF and opens it in a new tab; **↓ Download
 *    PDF** renders and saves it. Neither saves the document (the old
 *    Download also saved it as a draft — here Save draft is its own click);
 *  - a confirmed document gets **Sign for Darz** (`…/sign/`), as the
 *    exhibition invoices do (`ExhibitionComposePage.tsx`); a project has no
 *    portal, so both kinds offer it;
 *  - a draft in the list has **Continue**, which reopens the composer on it
 *    with the fields it was saved with.
 *
 * Kept from this port (no old counterpart, already approved on the
 * exhibition documents): the **reference** (`DARZ-PRO-…` shared with the
 * exhibition proposals, `DARZ-SINV-…` with their invoices — scanned over
 * every kind of the series, `exhibitionForm.ts::SERIES_KINDS`) and the
 * **currency choice** (no exchange rate exists: a proposal in a currency
 * the lines are not priced in goes out non-priced, see `currencyNote`).
 *
 * **The invoice is new — kept by the owner (2026-10-13).** The old Projects
 * area had no invoice composer —
 * only an invoice STATUS on the Money section (`:13801`). The backend now
 * stores one, so this card offers "Invoice" beside the proposal, built as
 * the exhibition services invoice is (billed to, the priced lines, total
 * due, payment note, terms, the bank block seeded from the last issued
 * invoice — `bankDetails.ts`). Owner login only, like every money surface on
 * the record, and only in a currency the lines are priced in: an invoice
 * with its prices left open is not an invoice.
 *
 * **Earlier proposals.** Until 2026-10-13 this section issued through the
 * generic documents API (kind `proposal`, `ref` = the project NUMBER). The
 * project-scoped list reads only `project_proposal` / `project_invoice` with
 * `ref` = the project's id, so such a document no longer shows on this card
 * — it stays in the Documents Library, and the PRO scan still counts its
 * number (`SERIES_KINDS`). The live site has never had a real backend
 * (Q-9), so no issued proposal is expected to be affected.
 *
 * Not ported, stated: **Share** (no share-link API — open or download the
 * PDF and send it), **⎙ Print** (print from the PDF), the preview's
 * Desktop / Tablet / Mobile frames, the old **Proposal Builder** desk
 * (`builder`, `:14644` — the free-form draft-to-document editor with AI
 * organise, custom sections and design options — skipped by the owner
 * 2026-10-13; the nav's "Proposal" tab says so), the Library copy of the rendered HTML (`_propArchive` — the
 * document itself is the record here, and the Documents desk lists it), and
 * the package's `internal.recFee` as the Total investment (`:14054` — that
 * field is internal-only on this backend; the total is the lines' sum).
 */
import { useCallback, useEffect, useState } from 'react';
import { useApi, useOptions } from '../../../api/hooks';
import type {
  DocumentAdmin,
  PackageTemplateAdmin,
  ProjectAdmin,
  ProjectDocKind,
  ServiceCatalogItemAdmin,
} from '../../../api/types';
import { DeskBanner } from '../kit';
import { SERIES_KINDS, nextReference, type BankDetails } from '../exhibitionForm';
import {
  EMPTY_BANK,
  newestBank,
  readLocalBank,
  saveLocalBank,
} from '../exhibitions/bankDetails';
import {
  PRICING_MODES,
  PROJECT_DOCS,
  buildProjectDocFields,
  composerFrom,
  docStatusWord,
  packageSummary,
  priceExists,
  pricingNote,
  type ComposerDraft,
  type PricingMode,
} from './projectDocs';
import {
  asPackageLines,
  choiceLabel,
  choices,
  defaultCurrency,
  fmtDate,
  walkPages,
  walkServices,
} from './projectForm';
import '../admin.css';

// the old detail's own inline styles on its list rows (:13813) and section gaps (:13793)
const FILE_NAME = { flex: 1, fontSize: 12, color: 'var(--ink2)' } as const;
const GAP12 = { marginTop: 12 } as const;
const GAP10 = { marginTop: 10 } as const;
// :14077 — the "Pricing" label's inline style
const PRICING_LBL = {
  fontSize: 8.5,
  fontWeight: 700,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'var(--ink3)',
  marginBottom: 6,
} as const;

/** The saved reference of a document (it lives in `fields`). */
function refOf(d: DocumentAdmin): string | undefined {
  return ((d.fields ?? {}) as Record<string, unknown>).reference as string | undefined;
}

const newestFirst = (a: DocumentAdmin, b: DocumentAdmin) =>
  a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;

/**
 * Every currency the package's lines are ACTUALLY priced in, in line order,
 * deduped. A line whose service is gone, or whose catalogue row carries no
 * currency of its own, contributes none — the calculator reads them the same
 * way (`ProjectsCalculatorPage.tsx:153-161`). Usually one entry: the whole
 * seeded catalogue is Toman (`standardSet.ts`).
 */
function lineCurrencies(
  pkg: Pick<PackageTemplateAdmin, 'lines'>,
  catalog: Array<Pick<ServiceCatalogItemAdmin, 'id' | 'currency'>>,
): string[] {
  const out: string[] = [];
  for (const l of asPackageLines(pkg.lines)) {
    const c = catalog.find((s) => s.id === l.svcId)?.currency;
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

/** The catalogue's prices can go onto the document only when every priced
 * line already agrees with the chosen currency — this app holds no exchange
 * rate and will not invent one. Lines with no currency of their own have
 * nothing to disagree with, so they carry as before. */
function carriesCataloguePrices(lineCurs: string[], chosen: string): boolean {
  return lineCurs.length === 0 || (lineCurs.length === 1 && lineCurs[0] === chosen);
}

/** The sentence under the currency choice on a PROPOSAL: which currency the
 * package's lines are priced in — so the choice is informed — and, when the
 * chosen one is not that, the plain reason the prices are left open. */
function currencyNote(a: {
  lineCurs: string[];
  chosen: string;
  canMoney: boolean;
  /** the options' label for a code, falling back to the code itself */
  word: (c: string) => string;
}): string {
  const { word } = a;
  const priced = a.lineCurs.map(word).join(' and ');
  if (!a.canMoney)
    return `${priced ? `The catalogue prices these lines in ${priced}. ` : ''}This login issues the non-priced version either way, so no price prints whichever currency is chosen — the choice only labels the document.`;
  if (a.lineCurs.length === 0)
    return `The package’s lines carry no currency of their own, so they go out under ${word(a.chosen)}.`;
  if (a.lineCurs.length > 1)
    return `The package’s lines are priced in more than one currency (${priced}), so no single choice matches them all. Nothing here converts between them: the line prices go out open — “On confirmation” on every line, no subtotal and no total.`;
  if (carriesCataloguePrices(a.lineCurs, a.chosen))
    return `The package’s lines are priced in ${priced} — this proposal carries those prices as they stand.`;
  return `The package’s lines are priced in ${priced} and this proposal is in ${word(a.chosen)}. Nothing here converts one into the other, so the line prices go out open: “On confirmation” on every line, and no subtotal or total — the same shape as the non-priced version, with the figures left for you to state. Choose ${word(a.lineCurs[0])} to carry the catalogue’s prices as they stand.`;
}

/** The same sentence on an INVOICE, which cannot go out with its prices
 * open — so a mismatch is a reason Finalize waits, not a shape it takes. */
function invoiceCurrencyNote(lineCurs: string[], chosen: string, word: (c: string) => string) {
  const priced = lineCurs.map(word).join(' and ');
  if (lineCurs.length === 0)
    return `The package’s lines carry no currency of their own, so they go out under ${word(chosen)}.`;
  if (lineCurs.length > 1)
    return `The package’s lines are priced in more than one currency (${priced}). Nothing here converts between them, so no single invoice can carry them all — issue it once the package is priced in one currency.`;
  if (carriesCataloguePrices(lineCurs, chosen))
    return `The package’s lines are priced in ${priced} — this invoice carries those prices as they stand.`;
  return `The package’s lines are priced in ${priced} and this invoice is in ${word(chosen)}. Nothing here converts one into the other, and an invoice cannot go out with its prices open — choose ${word(lineCurs[0])} to issue it.`;
}

export function ProjectProposal({
  project,
  canMoney,
  onIssued,
}: {
  project: ProjectAdmin;
  canMoney: boolean;
  /** called with the line the record's status bar shows */
  onIssued: (said: string) => void;
}) {
  const { projectsAdmin } = useApi();
  const [docs, setDocs] = useState<DocumentAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState<{
    kind: ProjectDocKind;
    draft: DocumentAdmin | null;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // a promise chain (the `useOptions` shape): state is set in the settle
  // callbacks, never synchronously inside the effect
  const load = useCallback(
    () =>
      walkPages((page) => projectsAdmin.documents(project.id, { page, per_page: 100 })).then(
        (all) => setDocs([...all].sort(newestFirst)),
        (err: unknown) =>
          setError(err instanceof Error ? err.message : 'Could not load the documents.'),
      ),
    [projectsAdmin, project.id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const sign = async (d: DocumentAdmin) => {
    setBusyId(d.id);
    setError(null);
    try {
      await projectsAdmin.signDocument(project.id, d.id);
      onIssued('Signed for Darz.');
      void load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not sign the document.');
    } finally {
      setBusyId(null);
    }
  };

  // :13850 — "Last saved · Final · date" from the newest proposal, else the old line
  const newest = docs?.find((d) => d.kind === 'project_proposal');
  const pst = newest
    ? `Last saved · ${newest.status === 'draft' ? 'Draft' : 'Final'} · ${fmtDate(newest.updated_at)}`
    : 'Not created yet';

  const open = (kind: ProjectDocKind) => {
    // an unfinished draft of the same kind is continued, never doubled
    const draft = docs?.find((d) => d.kind === kind && d.status === 'draft') ?? null;
    setComposing({ kind, draft });
  };

  return (
    <>
      {/* :13851 */}
      <div className="dzp-darz">
        <div className="h">Client proposal</div>
        <p>
          Generate, preview and share the polished Darz proposal for the applied package —{' '}
          {pst}.
        </p>
        {/* the sentence's "share" has no counterpart here — said so */}
        <div className="dzp-mut" style={GAP12}>
          No share link — preview or download the PDF and send it yourself.
        </div>
        {error && <DeskBanner>{error}</DeskBanner>}
        {docs === null && !error && <p className="dz-state">Loading…</p>}
        {docs && docs.length > 0 && (
          <div style={GAP12}>
            {docs.map((d) => (
              <div className="dzp-line" key={d.id}>
                <span style={FILE_NAME}>
                  {refOf(d) || d.title} ·{' '}
                  {PROJECT_DOCS[d.kind as ProjectDocKind]?.word ?? d.kind} · {docStatusWord(d)}
                </span>
                {d.status === 'draft' && (
                  <button
                    type="button"
                    className="dzp-btn sm gho"
                    disabled={!!composing}
                    onClick={() => setComposing({ kind: d.kind as ProjectDocKind, draft: d })}
                  >
                    Continue
                  </button>
                )}
                {d.status === 'confirmed' && !d.signed_at && (
                  <button
                    type="button"
                    className="dzp-btn sm gho"
                    disabled={busyId === d.id}
                    onClick={() => void sign(d)}
                  >
                    Sign for Darz
                  </button>
                )}
                {d.pdf_url ? (
                  <a
                    className="dzp-btn sm gho"
                    href={d.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open PDF
                  </a>
                ) : (
                  <span className="dzp-mut">no PDF yet</span>
                )}
              </div>
            ))}
          </div>
        )}
        {!composing && (
          <div className="dzp-acts">
            {/* The list failing to load never blocks the composer (it has
                its own reference fallback) — the buttons wait only while
                the list is still on its way. */}
            <button
              type="button"
              className="dzp-btn sm pri"
              disabled={docs === null && !error}
              onClick={() => open('project_proposal')}
            >
              Preview &amp; share proposal
            </button>
            {canMoney && (
              // new — see the header; the passport's Proposal / Invoice pair (:27970-27972)
              <button
                type="button"
                className="dzp-btn sm"
                disabled={docs === null && !error}
                onClick={() => open('project_invoice')}
              >
                Invoice
              </button>
            )}
          </div>
        )}
      </div>
      {composing && (
        <DocComposer
          key={`${composing.kind}:${composing.draft?.id ?? 'new'}`}
          project={project}
          canMoney={canMoney}
          kind={composing.kind}
          draft={composing.draft}
          docs={docs ?? []}
          onClose={() => setComposing(null)}
          onSaved={() => void load()}
          onDone={(said) => {
            setComposing(null);
            void load();
            onIssued(said);
          }}
        />
      )}
    </>
  );
}

/**
 * The composer (`_propForm`, `:14051-14088`), inline. Everything it builds
 * from — the package, the catalogue, the next reference, the bank block —
 * is read once on open; Save draft / Finalize / Preview / Download each
 * build the fields from those rows and the form as it stands.
 */
function DocComposer({
  project,
  canMoney,
  kind,
  draft,
  docs,
  onClose,
  onSaved,
  onDone,
}: {
  project: ProjectAdmin;
  canMoney: boolean;
  kind: ProjectDocKind;
  draft: DocumentAdmin | null;
  docs: DocumentAdmin[];
  onClose: () => void;
  onSaved: () => void;
  onDone: (said: string) => void;
}) {
  const { projectsAdmin, documentsAdmin } = useApi();
  const options = useOptions();
  const invoice = kind === 'project_invoice';
  const meta = PROJECT_DOCS[kind];
  const year = new Date().getFullYear();

  // ── the rows the document is built from
  const [pkg, setPkg] = useState<PackageTemplateAdmin | null>(null);
  const [catalog, setCatalog] = useState<ServiceCatalogItemAdmin[] | null>(null);
  const [readErr, setReadErr] = useState('');
  useEffect(() => {
    if (!project.applied_package) return;
    let alive = true;
    Promise.all([
      projectsAdmin.packageTemplate(project.applied_package),
      walkServices(projectsAdmin),
    ]).then(
      ([p, c]) => {
        if (!alive) return;
        setPkg(p);
        setCatalog(c);
      },
      (err: unknown) =>
        alive && setReadErr(err instanceof Error ? err.message : 'the package read failed'),
    );
    return () => {
      alive = false;
    };
  }, [projectsAdmin, project.applied_package]);

  // ── the form — a saved draft's fields first (composerFrom)
  const [d, setD] = useState<ComposerDraft>(() =>
    composerFrom(kind, project, null, draft?.fields, {
      reference: '',
      currency: '',
      // this device's copy at once; the newest issued invoice's lands below
      bank: kind === 'project_invoice' ? readLocalBank() : undefined,
    }),
  );
  const set = <K extends keyof ComposerDraft>(k: K, v: ComposerDraft[K]) =>
    setD((cur) => ({ ...cur, [k]: v }));
  // the package's name is the old default title (:14035) — it shows once the
  // package lands, until a saved draft or the admin gives another
  const [titleTouched, setTitleTouched] = useState(!!draft);
  const title = titleTouched ? d.title : pkg?.name || d.title;

  // rule 4 (highest seen): one series over every kind that draws from it —
  // a failed library read falls back to this project's own documents (a
  // lower floor, still monotonic). A saved draft keeps its number.
  useEffect(() => {
    if (d.reference) return;
    let alive = true;
    const kinds = SERIES_KINDS[meta.code] ?? [kind];
    Promise.all(
      kinds.map((k) =>
        walkPages((page) => documentsAdmin.documents({ kind: k, page, per_page: 100 })),
      ),
    ).then(
      (lists) =>
        alive && set('reference', nextReference(lists.flat().map(refOf), meta.code, year)),
      () =>
        alive &&
        set(
          'reference',
          nextReference(docs.filter((x) => x.kind === kind).map(refOf), meta.code, year),
        ),
    );
    return () => {
      alive = false;
    };
    // `set` is stable in effect (a setState wrapper); `d.reference` gates it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentsAdmin, kind, meta.code, year, docs]);

  // the invoice's bank block: the newest issued invoice's (exhibition or
  // project) over this device's copy — never over what was typed or saved
  const [bankTouched, setBankTouched] = useState(!!draft);
  useEffect(() => {
    if (!invoice || bankTouched) return;
    let alive = true;
    Promise.all(
      (SERIES_KINDS.SINV ?? []).map((k) =>
        documentsAdmin.documents({ kind: k, per_page: 20 }),
      ),
    ).then(
      (pages) => {
        const found = newestBank(pages.flatMap((p) => p.results).sort(newestFirst));
        if (alive && found) setD((cur) => ({ ...cur, bank: found }));
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [documentsAdmin, invoice, bankTouched]);

  // ── the currency (a choice, never a conversion)
  const currencies = choices(options, 'currency');
  const lineCurs = pkg && catalog ? lineCurrencies(pkg, catalog) : null;
  const reading = !!project.applied_package && lineCurs === null && !readErr;
  const linesCur = lineCurs?.length === 1 ? lineCurs[0] : '';
  const currency = d.currency || linesCur || defaultCurrency(options);
  // a <select> whose value has no option of its own silently shows a
  // different one: the options list can still be loading, and the catalogue
  // could one day carry a code the list does not
  const currencyChoices = currencies.some((c) => c.value === currency)
    ? currencies
    : [{ value: currency, label: currency || '—' }, ...currencies];
  const curWord = (c: string) => choiceLabel(currencies, c) || c || '—';
  const carries = lineCurs !== null && carriesCataloguePrices(lineCurs, currency);
  const priced = !!pkg && !!catalog && priceExists(pkg, catalog);

  // ── issuing
  const [doc, setDoc] = useState<DocumentAdmin | null>(draft);
  const [step, setStep] = useState<'form' | 'working'>('form');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [said, setSaid] = useState('');

  const whyNot = !project.applied_package
    ? 'No package is applied to this project.'
    : readErr
      ? `The package could not be read (${readErr}).`
      : !d.reference.trim()
        ? 'A reference is needed.'
        : invoice && !carries
          ? 'An invoice needs its prices — see the currency note.'
          : '';

  const fields = () => {
    if (!pkg || !catalog) throw new Error('The package is still loading.');
    const full: ComposerDraft = { ...d, title, currency };
    return buildProjectDocFields(project, pkg, catalog, full, {
      money: canMoney && carries,
    });
  };
  const docTitle = () =>
    invoice ? `${project.name} — Invoice` : title.trim() || `${project.name} — Proposal`;

  /** Create the document the first time, PATCH its fields after. */
  const save = async (): Promise<DocumentAdmin> => {
    const f = fields();
    if (invoice) saveLocalBank(d.bank);
    const saved = doc
      ? await documentsAdmin.updateDocument(doc.id, { title: docTitle(), fields: f })
      : await projectsAdmin.createDocument(project.id, {
          doc_type: kind,
          title: docTitle(),
          fields: f,
        });
    setDoc(saved);
    return saved;
  };

  const render = async () => {
    const { renderDocumentPdf } = await import('../pdf/renderPdf');
    return renderDocumentPdf(meta.render, fields());
  };

  const saveDraft = async () => {
    setError('');
    setSaid('');
    try {
      await save();
      onSaved();
      setSaid(`${meta.word} draft saved`); // :14104
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the draft.');
    }
  };

  const finalize = async () => {
    setStep('working');
    setError('');
    setSaid('');
    let saved: DocumentAdmin | null = doc;
    try {
      setProgress('Saving the draft…');
      saved = await save();
      setProgress('Rendering the PDF…');
      const blob = await render();
      setProgress('Uploading…');
      await projectsAdmin.uploadDocumentPdf(project.id, saved.id, blob, `${d.reference}.pdf`);
      setProgress('Confirming…');
      await projectsAdmin.confirmDocument(project.id, saved.id);
      onDone(`${meta.word} finalized & saved to the Library`); // :14105
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Finalizing failed.');
      setStep('form');
      // the draft exists on the server — let the list show it as such
      if (saved) onSaved();
    }
  };

  const download = async () => {
    setError('');
    try {
      const blob = await render();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${d.reference || meta.word}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not render the PDF.');
    }
  };

  const preview = async () => {
    setError('');
    // opened on the click itself, so no pop-up blocker stands between the
    // render and the tab; the PDF lands in it when ready
    const tab = window.open('', '_blank');
    try {
      const blob = await render();
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url;
      else window.open(url, '_blank');
    } catch (err) {
      tab?.close();
      setError(err instanceof Error ? err.message : 'Could not render the PDF.');
    }
  };

  const busy = step === 'working';
  const chip = doc
    ? `${doc.status === 'draft' ? 'Draft' : 'Final'} · ${fmtDate(doc.updated_at)}`
    : 'Draft';

  return (
    <div className="dzp-darz">
      {/* :14066 — the head: eyebrow, title, the Draft / Final chip */}
      <div className="h">{invoice ? 'Services invoice' : 'Proposal preview & sharing'}</div>
      <p>
        <b>{invoice ? d.projectName || project.name : title || 'Proposal'}</b>{' '}
        <span className="dzp-chip">{chip}</span>
      </p>

      {/* :14058 — what the document is built from */}
      <div className="dzp-darz">
        <div className="h">From the package · {pkg?.name || 'Package'}</div>
        <p>
          {pkg && catalog
            ? packageSummary(pkg, catalog, canMoney, currency)
            : readErr
              ? `The package could not be read (${readErr}).`
              : 'Reading the package…'}
        </p>
      </div>

      {busy ? (
        <p className="dz-state" style={GAP12}>
          {progress}
        </p>
      ) : (
        <>
          <div className="dzp-form" style={GAP12}>
            <label>
              <span className="fl">{meta.label} reference</span>
              <input
                value={d.reference}
                disabled={!!doc}
                onChange={(e) => set('reference', e.target.value)}
              />
            </label>
            <label>
              <span className="fl">Currency</span>
              <select
                value={currency}
                disabled={reading}
                onChange={(e) => set('currency', e.target.value)}
              >
                {currencyChoices.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            {!invoice && (
              <label className="full">
                <span className="fl">Proposal title</span>
                <input
                  value={title}
                  onChange={(e) => {
                    setTitleTouched(true);
                    set('title', e.target.value);
                  }}
                />
              </label>
            )}
            <label>
              <span className="fl">{invoice ? 'Billed to' : 'Client name'}</span>
              <input value={d.client} onChange={(e) => set('client', e.target.value)} />
            </label>
            <label>
              <span className="fl">Project / show</span>
              <input
                value={d.projectName}
                onChange={(e) => set('projectName', e.target.value)}
              />
            </label>
          </div>
          {lineCurs !== null && (
            <div className="dzp-mut" style={GAP10}>
              {invoice
                ? invoiceCurrencyNote(lineCurs, currency, curWord)
                : currencyNote({ lineCurs, chosen: currency, canMoney, word: curWord })}
            </div>
          )}

          {invoice ? (
            <div className="dzp-form" style={GAP10}>
              <label className="full">
                <span className="fl">Note from Darz</span>
                <textarea
                  className="dzp-ta"
                  rows={2}
                  value={d.note}
                  placeholder="Payment terms, a reference to quote, anything to add"
                  onChange={(e) => set('note', e.target.value)}
                />
              </label>
              <label className="full">
                <span className="fl">Payment terms</span>
                <textarea
                  className="dzp-ta"
                  rows={2}
                  value={d.terms}
                  placeholder="e.g. 50% on signing, 50% on delivery"
                  onChange={(e) => set('terms', e.target.value)}
                />
              </label>
              {(
                [
                  ['holder', 'Account holder'],
                  ['bank', 'Bank'],
                  ['card', 'Card no.'],
                  ['iban', 'Sheba (IBAN)'],
                ] as Array<[keyof BankDetails, string]>
              ).map(([k, label]) => (
                <label key={k}>
                  <span className="fl">{label}</span>
                  <input
                    value={d.bank[k] ?? ''}
                    onChange={(e) => {
                      setBankTouched(true);
                      set('bank', { ...EMPTY_BANK, ...d.bank, [k]: e.target.value });
                    }}
                  />
                </label>
              ))}
            </div>
          ) : (
            <>
              <div className="dzp-form" style={GAP10}>
                <label className="full">
                  <span className="fl">Short introduction</span>
                  <textarea
                    className="dzp-ta"
                    value={d.intro}
                    onChange={(e) => set('intro', e.target.value)}
                  />
                </label>
                <label className="full">
                  <span className="fl">
                    Notes / terms (optional — shown above the package terms)
                  </span>
                  <textarea
                    className="dzp-ta"
                    value={d.notes}
                    onChange={(e) => set('notes', e.target.value)}
                  />
                </label>
              </div>
              {/* :14060-14064 · :14077 */}
              <div style={GAP12}>
                <div className="fl" style={PRICING_LBL}>
                  Pricing
                </div>
                {canMoney ? (
                  <>
                    <div className="dzp-acts" style={{ marginTop: 2 }}>
                      {PRICING_MODES.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          className={`dzp-tog${d.pricing === m.value ? ' on' : ''}`}
                          aria-pressed={d.pricing === m.value}
                          onClick={() => set('pricing', m.value as PricingMode)}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div className="dzp-mut" style={{ marginTop: 6 }}>
                      {pricingNote(d.pricing, priced)}
                    </div>
                  </>
                ) : (
                  <div className="dzp-mut">
                    Pricing is visible to the owner login only — this proposal sends as the
                    refined, non-priced version.
                  </div>
                )}
              </div>
            </>
          )}

          {error && <DeskBanner>{error}</DeskBanner>}
          {said && (
            <div className="dzp-mut" style={GAP12} role="status">
              {said}
            </div>
          )}
          {doc && doc.status === 'draft' && (
            <div className="dzp-mut" style={GAP12}>
              Saved as the draft {d.reference} — Finalize renders its PDF and confirms it.
            </div>
          )}
          {whyNot && !reading && (
            <div className="dzp-mut" style={GAP12}>
              {whyNot}
            </div>
          )}

          {/* :14079-14086 — Cancel left; Save draft · Finalize · Download ·
              Preview right (Share and Print not ported, see the header) */}
          <div className="dzp-acts" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="dzp-btn gho" onClick={onClose}>
              Cancel
            </button>
            <span className="dzp-acts" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="dzp-btn"
                disabled={reading || !!readErr || !d.reference.trim()}
                onClick={() => void saveDraft()}
              >
                Save draft
              </button>
              <button
                type="button"
                className="dzp-btn"
                disabled={reading || !!whyNot}
                onClick={() => void finalize()}
              >
                Finalize
              </button>
              <button
                type="button"
                className="dzp-btn"
                disabled={reading || !!readErr}
                onClick={() => void download()}
              >
                ↓ Download PDF
              </button>
              <button
                type="button"
                className="dzp-btn pri"
                disabled={reading || !!readErr}
                onClick={() => void preview()}
              >
                Preview
              </button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
