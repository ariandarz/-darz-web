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
 *  - a non-owner sees the old pricing toggle collapsed to its :14067 line
 *    and issues the old "calm non-priced version" (:14028): the snapshot
 *    carries no line prices, no subtotal and no total, and the shared
 *    `documentPdf` drops its totals block when the total is undefined, so
 *    the client-facing PDF shows the scope with no money on it;
 *  - the card's sentence (:13854) still says "preview and share"; a line
 *    under it says neither exists here — issuing confirms the PDF at once;
 *  - the documents list has no `ref` filter (only `kind`), so the card walks
 *    every proposal and filters client-side;
 *  - a failure after the draft was created (render / upload / confirm)
 *    keeps that draft in hand: Issue again resumes from the PDF under the
 *    same reference (never a second document with the same number), and
 *    the list reloads so the draft shows meanwhile.
 * Copy: the document's status prints from `documents.status` (options),
 * except a confirmed proposal reads "Final" — the old :13853 word.
 * Not ported: the composer's free-text intro, the three pricing modes, the
 * share link and the print view — no API for a share link, and the
 * document's own note + terms fields are what prints.
 */
import { useCallback, useEffect, useState } from 'react';
import { useApi, useOptions } from '../../../api/hooks';
import type { Choice, DocumentAdmin, ProjectAdmin } from '../../../api/types';
import { DeskBanner } from '../kit';
import { nextReference } from '../exhibitionForm';
import type { DocumentPdfFields } from '../pdf/renderPdf';
import {
  PROPOSAL_SERIES,
  asPackageLines,
  buildProposalFields,
  choiceLabel,
  choices,
  defaultCurrency,
  fmtDate,
  walkPages,
} from './projectForm';
import '../admin.css';

// the old detail's own inline styles on its list rows (:13813) and section gaps (:13793)
const FILE_NAME = { flex: 1, fontSize: 12, color: 'var(--ink2)' } as const;
const GAP12 = { marginTop: 12 } as const;

/** :13853 — the one old word kept over the options label: a confirmed
 * proposal read "Final" (the old proposal's own `final` status). */
const STATUS_WORDS: Record<string, string> = { confirmed: 'Final' };

/** The saved reference of a document (rule 1: it lives in `fields`). */
function refOf(d: DocumentAdmin): string | undefined {
  return ((d.fields ?? {}) as Record<string, unknown>).reference as string | undefined;
}

/** The document's status in words — the `documents.status` label, :13853's
 * "Final" for a confirmed one. */
function statusWord(list: Choice[], d: DocumentAdmin): string {
  return STATUS_WORDS[d.status] ?? choiceLabel(list, d.status);
}

/** A draft created by the issue chain whose PDF is not confirmed yet. */
interface PendingDraft {
  doc: DocumentAdmin;
  fields: DocumentPdfFields;
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
  const docStatuses = choices(useOptions(), 'documents.status');
  const [docs, setDocs] = useState<DocumentAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  // a promise chain (the `useOptions` shape): state is set in the settle
  // callbacks, never synchronously inside the effect
  const load = useCallback(
    () =>
      walkPages((page) =>
        documentsAdmin.documents({ kind: 'proposal', page, per_page: 100 }),
      ).then(
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
    ? `Last saved · ${statusWord(docStatuses, newest)} · ${fmtDate(newest.updated_at)}`
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
        {/* the sentence's preview and share have no counterpart here (no share
            link on the API, no preview step in the one-go chain) — said so */}
        <div className="dzp-mut" style={GAP12}>
          No preview or share link yet — issuing renders and confirms the PDF in one go; open
          it from the list below.
        </div>
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
                  {refOf(d) || d.title} · {statusWord(docStatuses, d)}
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
            {/* Either login issues: the non-priced version carries no totals
                at all and the renderer now drops the block for an undefined
                total (`documentPdf.tsx`), so nothing prints a zero. The list
                failing to load never blocks issuing (the chain has its own
                reference fallback) — the button waits only while the list is
                still on its way. */}
            <button
              type="button"
              className="dzp-btn sm pri"
              disabled={docs === null && !error}
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
          onCreated={() => void load()}
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
 * without further clicks. The snapshot never re-derives (rule 1). A failure
 * after the create keeps the draft as `pending`: the next click resumes at
 * the render with the SAME document and snapshot, so the reference is issued
 * once (`onCreated` reloads the card's list so the draft shows meanwhile).
 */
function ProposalIssueCard({
  project,
  canMoney,
  docs,
  onClose,
  onCreated,
  onDone,
}: {
  project: ProjectAdmin;
  canMoney: boolean;
  docs: DocumentAdmin[];
  onClose: () => void;
  onCreated: () => void;
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
  const [pending, setPending] = useState<PendingDraft | null>(null);

  // rule 4 (highest seen): one PRO series over project AND exhibition
  // proposals; the library being unreachable never blocks issuing — fall
  // back to this project's own documents (a lower floor, still monotonic).
  // Once a draft is pending its reference is fixed — no re-prefill.
  useEffect(() => {
    if (pending) return;
    let alive = true;
    Promise.all([
      walkPages((page) => documentsAdmin.documents({ kind: 'proposal', page, per_page: 100 })),
      walkPages((page) =>
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
  }, [documentsAdmin, year, docs, pending]);

  const issue = async () => {
    setStep('working');
    setError('');
    let draft = pending;
    try {
      if (!draft) {
        if (!project.applied_package)
          throw new Error('No package is applied to this project.');
        setProgress('Reading the package…');
        const [pkg, catalog] = await Promise.all([
          projectsAdmin.packageTemplate(project.applied_package),
          walkPages((page) => projectsAdmin.services({ page, per_page: 100 })),
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
          // :14067 / :14028 — the refined, non-priced version carries no
          // pricing at all: no line prices, no subtotal, no total (the card
          // gates the button until the renderer can print this shape)
          fields.lines = (fields.lines ?? []).map((l) => ({ ...l, price: '' }));
          delete fields.subtotal;
          delete fields.discount;
          delete fields.total;
        }
        setProgress('Creating the document…');
        const doc = await documentsAdmin.createDocument({
          kind: 'proposal',
          title: `${project.name} — Project proposal`,
          ref: project.no,
          fields: { ...fields },
        });
        draft = { doc, fields };
        setPending(draft);
      }
      setProgress('Rendering the PDF…');
      const { renderDocumentPdf } = await import('../pdf/renderPdf');
      const blob = await renderDocumentPdf('exhibition_proposal', draft.fields);
      setProgress('Uploading…');
      await documentsAdmin.uploadPdf(
        draft.doc.id,
        new File([blob], `${draft.fields.reference ?? reference}.pdf`, {
          type: 'application/pdf',
        }),
      );
      setProgress('Confirming (issuing)…');
      await documentsAdmin.confirmDocument(draft.doc.id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The issue chain failed.');
      setStep('form');
      // the draft exists on the server — let the list show it as such
      if (draft) onCreated();
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
              <input
                value={reference}
                disabled={!!pending}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <label className="full">
              <span className="fl">Note from Darz</span>
              <textarea
                className="dzp-ta"
                rows={2}
                value={note}
                disabled={!!pending}
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
                disabled={!!pending}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
          {error && <DeskBanner>{error}</DeskBanner>}
          {pending && (
            <div className="dzp-mut" style={GAP12}>
              The draft {pending.fields.reference ?? reference} is created with these fields —
              Issue again resumes from the PDF.
            </div>
          )}
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
