/**
 * DocumentsPage — `/admin/documents`, the Documents desk (`documentsView()`,
 * `workspaces-runtime.js:507`; the group's tabs at `darz-studio.html:11732`)
 * over backend Phase 11's documents admin.
 *
 * Ported content:
 *  - the title "Documents" and the group's tab shape: Proposals and Invoices
 *    are THIS desk pre-filtered by kind (`?kind=` — the old sticky sub-tab,
 *    one page in both panels), Library is the unfiltered whole;
 *  - the Library line's facts (`:516`): numbered once (`ref`), kept in
 *    versions, Open renders the saved document (here `pdf_url`);
 *  - the lifecycle the old sub-line promised, now the model's own: a draft
 *    is never visible until issued; confirm locks; the gallery-signs half
 *    of the old sentence waits on the portal (Phase 10).
 *
 * **Not ported, stated:** the History tab — its "issued documents" half IS
 * this list (one model now); its activity half waits on an audit feed
 * (G-DOC-2). The Document Builder tab is the Studio and waits on D18 (the
 * PDF renderer decision) — the backend's own contract says "the PDF is
 * rendered client-side… uploaded here", so the desk today uploads a
 * hand-rendered PDF and the Studio will plug into the same endpoint.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import type { DocumentsAdminService } from '../../api/services';
import type { DocumentAdmin, DocumentQuery, Paginated } from '../../api/types';
import { ListController } from '../shared/ListController';
import { useListController } from '../shared/useListController';
import { DeskAction, DeskList, DeskPage, SelectFilter, type Column } from './kit';
import './admin.css';

class DocumentsController extends ListController<DocumentAdmin, DocumentQuery> {
  private readonly docs: DocumentsAdminService;
  constructor(docs: DocumentsAdminService, initial: DocumentQuery = {}) {
    super(initial);
    this.docs = docs;
  }
  protected fetchPage(query: DocumentQuery): Promise<Paginated<DocumentAdmin>> {
    return this.docs.documents(query);
  }
}

/** The kinds the desk offers on create — the old taxonomy's most-used names
 * (the model keeps `kind` freeform on purpose; the input takes any). */
const COMMON_KINDS = [
  'proposal',
  'invoice',
  'certificate',
  'contract',
  'pricelist',
  'exhibition_services',
  'legal_documents',
];

export function DocumentsPage() {
  const { documentsAdmin } = useApi();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const kindParam = params.get('kind') ?? undefined;

  const { state, setQuery, setPage, reload } = useListController<DocumentAdmin, DocumentQuery>(
    () => new DocumentsController(documentsAdmin, { kind: kindParam }),
  );

  // the URL is the filter's home (the nav's Proposals/Invoices tabs point
  // here with ?kind=) — keep the controller following it. Guarded on a real
  // change: the hook's setQuery is a fresh closure every render, so an unguarded
  // call here is an infinite update loop (found live).
  useEffect(() => {
    if (state.query.kind !== kindParam) setQuery({ kind: kindParam });
  }, [kindParam, state.query.kind, setQuery]);

  const [creating, setCreating] = useState(false);

  const columns: ReadonlyArray<Column<DocumentAdmin>> = [
    {
      key: 'doc',
      header: 'Document',
      cell: (d) => (
        <>
          <span className="ad-cellmain">{d.title}</span>
          <span className="ad-cellsub">
            {d.kind}
            {d.ref ? ` · ${d.ref}` : ''}
          </span>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (d) => <DocPill status={d.status} signed={!!d.signed_at} />,
    },
    {
      key: 'visibility',
      header: 'Visibility',
      cell: (d) => (
        <span className="ad-cellsub">
          {d.visibility === 'public' ? 'Public' : 'Private'}
          {d.owner_lock ? ' · owner-locked' : ''}
        </span>
      ),
    },
    {
      key: 'pdf',
      header: 'PDF',
      cell: (d) =>
        d.pdf_url ? (
          <a className="ad-rowbtn" href={d.pdf_url} target="_blank" rel="noreferrer">
            Open
          </a>
        ) : (
          <span className="ad-cellsub">none yet</span>
        ),
    },
    {
      key: 'updated',
      header: 'Updated',
      className: 'ad-when',
      cell: (d) => new Date(d.updated_at).toLocaleDateString('en-GB'),
    },
    {
      key: 'open',
      header: '',
      cell: (d) => (
        <button
          type="button"
          className="ad-rowbtn"
          onClick={() => navigate(`/admin/documents/${d.id}`)}
        >
          Open
        </button>
      ),
    },
  ];

  return (
    <DeskPage
      wide
      title="Documents"
      action={<DeskAction onClick={() => setCreating(true)}>＋ New document</DeskAction>}
      toolbar={
        <SelectFilter
          label="Kind"
          anyLabel="All kinds"
          value={kindParam}
          onChange={(kind) => {
            if (kind) setParams({ kind });
            else setParams({});
          }}
          choices={COMMON_KINDS.map((k) => ({ value: k, label: k }))}
        />
      }
      subtitle={
        <>
          Each document is numbered once (its reference) and kept in versions. A draft is
          editable and never visible until issued; <b>Confirm</b> needs an uploaded PDF and
          locks the record; <b>Sign</b> follows confirmation. The backend never renders a
          document — the PDF is made client-side and uploaded (the Studio, D18, plugs into the
          same contract).
        </>
      }
    >
      {creating && (
        <NewDocumentForm
          initialKind={kindParam}
          onClose={() => setCreating(false)}
          onSaved={(doc) => {
            setCreating(false);
            void reload();
            navigate(`/admin/documents/${doc.id}`);
          }}
        />
      )}

      <DeskList
        label="Documents"
        status={state.status}
        error={state.error}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(d) => d.id}
        empty={
          kindParam
            ? `No ${kindParam} documents yet.`
            : 'No documents yet — create one, or they arrive as the desks issue them.'
        }
      />
    </DeskPage>
  );
}

/** draft → res (in the works) · confirmed → ok · archived → neut; a signed
 * document says so beside the pill. */
export function DocPill({ status, signed }: { status: string; signed: boolean }) {
  const cls = status === 'confirmed' ? 'ok' : status === 'archived' ? 'neut' : 'res';
  return (
    <span className="ad-rowacts">
      <span className={`ad-stpill is-${cls}`}>{status}</span>
      {signed && <span className="ad-stpill is-ok">signed</span>}
    </span>
  );
}

function NewDocumentForm({
  initialKind,
  onClose,
  onSaved,
}: {
  initialKind?: string;
  onClose: () => void;
  onSaved: (doc: DocumentAdmin) => void;
}) {
  const { documentsAdmin } = useApi();
  const [kind, setKind] = useState(initialKind ?? '');
  const [title, setTitle] = useState('');
  const [ref, setRef] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [ownerLock, setOwnerLock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    if (!kind.trim() || !title.trim()) {
      setError('A document needs a kind and a title.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSaved(
        await documentsAdmin.createDocument({
          kind: kind.trim(),
          title: title.trim(),
          ref: ref.trim(),
          visibility,
          owner_lock: ownerLock,
        }),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create the document.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-card ad-form">
      <div className="ad-form-h">New document</div>
      <div className="ad-form-grid">
        <label className="ad-field">
          <span className="ad-filter-l">Kind</span>
          <input
            list="ad-dockinds"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            placeholder="proposal, invoice, certificate…"
            autoFocus
          />
          <datalist id="ad-dockinds">
            {COMMON_KINDS.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Reference · optional</span>
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="e.g. INV-2026-014"
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Visibility</span>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="private">Private — shared by signed link</option>
            <option value="public">Public — openly linkable once confirmed</option>
          </select>
        </label>
      </div>
      <label className="ad-actck" style={{ maxWidth: 'fit-content' }}>
        <input
          type="checkbox"
          checked={ownerLock}
          onChange={(e) => setOwnerLock(e.target.checked)}
        />
        Owner lock — only the owner may edit, confirm or sign this document
      </label>
      {error && (
        <p className="dz-state err" role="alert">
          {error}
        </p>
      )}
      <div className="ad-form-a">
        <button type="button" className="ad-ghostbtn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="ad-action"
          onClick={() => void save()}
          disabled={busy}
        >
          Create document
        </button>
      </div>
    </div>
  );
}
