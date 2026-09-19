/**
 * ProjectProposal — the Proposal section of the project record
 * (`darz-studio.html:13851-13855`): the `.dzp-darz` "Client proposal" card
 * the old detail showed only once a package was applied, with its status
 * line, plus the issue chain behind its button.
 *
 * What changed: the old button ("Preview & share proposal", :13854) opened
 * the Proposal composer (`projProposal` :14049 → `_propForm` :14054 — title
 * / intro / notes fields, a pricing toggle, Save draft / Finalize / Share /
 * Download / Print / Preview over a localStorage draft). Here a proposal IS
 * a `documents.Document` (kind `proposal`, `ref` = the project number, the
 * package snapshot in `fields`), created → rendered client-side (the shared
 * proposal PDF, `../pdf/renderPdf`) → uploaded → confirmed in one go — the
 * same chain as the exhibition documents (`IssueDocumentDialog`,
 * ExhibitionComposePage.tsx), so the button reads "Issue proposal" and the
 * card lists this project's issued documents with their PDF. The reference
 * follows doc-reference.js: ONE `PRO` series shared with the exhibition
 * proposals, scanned over both kinds so a number is never reused.
 *
 * Stated on screen rather than dropped:
 *  - a non-owner sees the old pricing toggle collapsed to its :14067 line and
 *    the lines go out unpriced ("On confirmation" on the PDF; the shared
 *    renderer still prints a zero total line — a renderer limit, not a
 *    pricing choice);
 *  - the documents list has no `ref` filter (only `kind`), so the card walks
 *    every proposal and filters client-side.
 * Not ported: the composer's free-text intro, the three pricing modes, the
 * share link and the print view — no API for a share link, and the
 * document's own note + terms fields are what prints.
 */
import { useCallback, useEffect, useState } from 'react';
import { useApi, useOptions } from '../../../api/hooks';
import type { DocumentAdmin, Paginated, ProjectAdmin } from '../../../api/types';
import { DeskBanner } from '../kit';
import { nextReference } from '../exhibitionForm';
import {
  PROPOSAL_SERIES,
  asPackageLines,
  buildProposalFields,
  defaultCurrency,
  fmtDate,
} from './projectForm';
import '../admin.css';

// the old detail's own inline styles on its list rows (:13813) and section gaps (:13793)
const FILE_NAME = { flex: 1, fontSize: 12, color: 'var(--ink2)' } as const;
const GAP12 = { marginTop: 12 } as const;

/** The saved reference of a document (rule 1: it lives in `fields`). */
function refOf(d: DocumentAdmin): string | undefined {
  return ((d.fields ?? {}) as Record<string, unknown>).reference as string | undefined;
}

/** :13853 — the old status vocabulary over the document's status. */
function statusWord(d: DocumentAdmin): string {
  if (d.status === 'confirmed') return 'Final';
  if (d.status === 'draft') return 'Draft';
  return d.status;
}

/** Every page of a list (the documents list has no `ref` filter). */
async function walk<T>(fetchPage: (page: number) => Promise<Paginated<T>>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 50; page++) {
    const p = await fetchPage(page);
    out.push(...p.results);
    if (!p.pagination.has_next) break;
  }
  return out;
}

export function ProjectProposal({
  project,
  canMoney,
  onIssued,
}: {
  project: ProjectAdmin;
  canMoney: boolean;
  onIssued: () => void;
}) {
  const { documentsAdmin } = useApi();
  const [docs, setDocs] = useState<DocumentAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  // a promise chain (the `useOptions` shape): state is set in the settle
  // callbacks, never synchronously inside the effect
  const load = useCallback(
    () =>
      walk((page) => documentsAdmin.documents({ kind: 'proposal', page, per_page: 100 })).then(
        (all) =>
          setDocs(
            all
              .filter((d) => d.ref === project.no)
              .sort((a, b) =>
                a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0,
              ),
          ),
        (err: unknown) =>
          setError(err instanceof Error ? err.message : 'Could not load the proposals.'),
      ),
    [documentsAdmin, project.no],
  );
  useEffect(() => {
    void load();
  }, [load]);

  // :13853 — "Last saved · Final · date" from the newest document, else the old line
  const newest = docs?.[0];
  const pst = newest
    ? `Last saved · ${statusWord(newest)} · ${fmtDate(newest.updated_at)}`
    : 'Not created yet';

  return (
    <>
      {/* :13854 */}
      <div className="dzp-darz">
        <div className="h">Client proposal</div>
        <p>
          Generate, preview and share the polished Darz proposal for the applied package —{' '}
          {pst}.
        </p>
        {!canMoney && (
          // :14067 — the old composer's owner-only pricing toggle, for a standard admin
          <div className="dzp-mut" style={GAP12}>
            Pricing is visible to the owner login only — this proposal sends as the refined,
            non-priced version.
          </div>
        )}
        {error && <DeskBanner>{error}</DeskBanner>}
        {docs === null && <p className="dz-state">Loading…</p>}
        {docs && docs.length > 0 && (
          <div style={GAP12}>
            {docs.map((d) => (
              <div className="dzp-line" key={d.id}>
                <span style={FILE_NAME}>
                  {refOf(d) || d.title} · {statusWord(d)}
                </span>
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
        {!issuing && (
          <div className="dzp-acts">
            <button
              type="button"
              className="dzp-btn sm pri"
              disabled={docs === null}
              onClick={() => setIssuing(true)}
            >
              Issue proposal
            </button>
          </div>
        )}
      </div>
      {issuing && (
        <ProposalIssueCard
          project={project}
          canMoney={canMoney}
          docs={docs ?? []}
          onClose={() => setIssuing(false)}
          onDone={() => {
            setIssuing(false);
            void load();
            onIssued();
          }}
        />
      )}
    </>
  );
}

/**
 * The one-click issue chain, the `IssueDocumentDialog` shape rendered inline
 * (the old detail had no second modal layer; `.ad-modal*` has no stylesheet
 * in this repo either): reference (prefilled from the highest PRO number
 * seen across BOTH proposal kinds), note, terms, then read the package +
 * catalogue → build the snapshot → create → render → upload → confirm
 * without further clicks. The snapshot never re-derives (rule 1).
 */
function ProposalIssueCard({
  project,
  canMoney,
  docs,
  onClose,
  onDone,
}: {
  project: ProjectAdmin;
  canMoney: boolean;
  docs: DocumentAdmin[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { projectsAdmin, documentsAdmin } = useApi();
  const options = useOptions();
  const year = new Date().getFullYear();
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [terms, setTerms] = useState('');
  const [step, setStep] = useState<'form' | 'working'>('form');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  // rule 4 (highest seen): one PRO series over project AND exhibition
  // proposals; the library being unreachable never blocks issuing — fall
  // back to this project's own documents (a lower floor, still monotonic)
  useEffect(() => {
    let alive = true;
    Promise.all([
      walk((page) => documentsAdmin.documents({ kind: 'proposal', page, per_page: 100 })),
      walk((page) =>
        documentsAdmin.documents({ kind: 'exhibition_proposal', page, per_page: 100 }),
      ),
    ]).then(
      ([a, b]) =>
        alive &&
        setReference(nextReference([...a, ...b].map(refOf), PROPOSAL_SERIES.code, year)),
      () => alive && setReference(nextReference(docs.map(refOf), PROPOSAL_SERIES.code, year)),
    );
    return () => {
      alive = false;
    };
  }, [documentsAdmin, year, docs]);

  const issue = async () => {
    setStep('working');
    setError('');
    try {
      if (!project.applied_package) throw new Error('No package is applied to this project.');
      setProgress('Reading the package…');
      const [pkg, catalog] = await Promise.all([
        projectsAdmin.packageTemplate(project.applied_package),
        walk((page) => projectsAdmin.services({ page, per_page: 100 })),
      ]);
      // the lines are priced from the catalogue, so the currency is the
      // catalogue's (first priced line), else the options' default
      const firstSvc = asPackageLines(pkg.lines)
        .map((l) => catalog.find((s) => s.id === l.svcId))
        .find((s) => s !== undefined);
      const currency = firstSvc?.currency || defaultCurrency(options);
      const clientName = project.client_partner_org?.name || project.client_name || '';
      const fields = buildProposalFields(project, pkg, catalog, {
        reference,
        note,
        terms,
        currency,
        clientName,
      });
      if (!canMoney) {
        // :14067 — the refined, non-priced version: no line prices, no sum
        fields.lines = (fields.lines ?? []).map((l) => ({ ...l, price: '' }));
        fields.subtotal = 0;
        fields.total = 0;
      }
      setProgress('Creating the document…');
      const doc = await documentsAdmin.createDocument({
        kind: 'proposal',
        title: `${project.name} — Project proposal`,
        ref: project.no,
        fields: { ...fields },
      });
      setProgress('Rendering the PDF…');
      const { renderDocumentPdf } = await import('../pdf/renderPdf');
      const blob = await renderDocumentPdf('exhibition_proposal', fields);
      setProgress('Uploading…');
      await documentsAdmin.uploadPdf(
        doc.id,
        new File([blob], `${reference}.pdf`, { type: 'application/pdf' }),
      );
      setProgress('Confirming (issuing)…');
      await documentsAdmin.confirmDocument(doc.id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The issue chain failed.');
      setStep('form');
    }
  };

  return (
    <div className="dzp-darz">
      <div className="h">Issue proposal</div>
      <p>
        Snapshot of the applied package as it stands — created, rendered and confirmed in one
        go.
      </p>
      {step === 'form' ? (
        <>
          <div className="dzp-form" style={GAP12}>
            <label className="full">
              <span className="fl">{PROPOSAL_SERIES.label} reference</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} />
            </label>
            <label className="full">
              <span className="fl">Note from Darz</span>
              <textarea
                className="dzp-ta"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional — prints on the document"
              />
            </label>
            <label className="full">
              <span className="fl">Terms</span>
              <textarea
                className="dzp-ta"
                rows={2}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
          {error && <DeskBanner>{error}</DeskBanner>}
          <div className="dzp-acts">
            <button type="button" className="dzp-btn gho" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="dzp-btn pri"
              disabled={!reference.trim()}
              onClick={() => void issue()}
            >
              Issue proposal
            </button>
          </div>
        </>
      ) : (
        <p className="dz-state">{progress}</p>
      )}
    </div>
  );
}
