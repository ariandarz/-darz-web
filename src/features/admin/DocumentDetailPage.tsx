/**
 * DocumentDetailPage — `/admin/documents/:id`: one document's record, its
 * content fields, its PDF and its lifecycle.
 *
 * The lifecycle is the backend's own (Phase 11): a DRAFT is editable
 * (title · ref · visibility · the freeform `fields` JSON); **Confirm needs
 * an uploaded PDF first** and locks the record; **Sign** follows
 * confirmation; **Archive** shelves it. `owner_lock` limits the guarded
 * moves to the owner — the server enforces it (`services.py:17-19`) and,
 * since Phase 6, so does the desk: for a standard admin every guarded control
 * (Save · Upload · Confirm · Sign · Archive, and the draft inputs) is disabled
 * with the reason on screen (`ownerLockReason`, `documentRules.ts`). The owner
 * is unaffected. Share is not guarded server-side, so it is not guarded here.
 *
 * **Share with collector (G-DOC-1).** The old panel's pill toggle, "Sharing" /
 * "Not shared" (`DZSales._docSectionHTML`, `darz-studio.html:12906`), and its
 * line "only shared documents appear in their Market App" (`:12912`), over
 * `POST/DELETE …/{id}/share/`. The old share lived on a deal, whose collector
 * was known; a document here may not have one yet, so a collector is picked
 * with the kit `Picker` (the Sales desk's collector search). Only the
 * collector-visible kinds offer it (`COLLECTOR_VISIBLE_KINDS`); the backend
 * 400s any other. A shared document lands in the collector's Profile ›
 * "Your documents" (Phase 1). A document can also reach a collector from the
 * chat composer (D19 `document_refs` — attach = share), and **Copy link**
 * still hands over the direct `pdf_url` (signed and expiring for a private
 * document, stable for a public one; public kinds also serve at
 * `GET /api/documents/public/{kind}/` once confirmed).
 *
 * **History (G-DOC-2)** is `DocumentHistory`, the per-document trail.
 *
 * The `fields` editor is the Import batch page's JSON-editor pattern: the
 * shape depends on `kind` and the model keeps it freeform, so a validated
 * JSON textarea is the honest editor until the Studio (D18) gives each kind
 * its form.
 *
 * **Delete (G-DEL-1, approved 2026-09-22).** The old panel's `dlDelDoc`
 * (`:17913`) had never been built here, so Django admin was the only way to
 * remove a document. Its confirm is ported verbatim, version count and all —
 * it is the one of the three that names what delete costs ("A version a
 * gallery already holds cannot be un-sent"), which is the reason to keep the
 * sentence rather than summarise it.
 *
 * **It is owner-only, and that is the STRICTER of the two rules in play.**
 * The old panel refuses a standard admin outright ("Only the owner can
 * delete an issued document", `:17913`); this API's endpoint is
 * `IsStandardAdminOrOwner`, so the server would allow it. G-DEL-1 called
 * that mismatch out and the owner approved the faithful reading: the desk
 * keeps the old gate. A standard admin does not see the button. Note this is
 * a UI gate over a permissive endpoint — the opposite of the deal delete
 * below it, where the endpoint is `IsOwner` and the UI merely agrees — so if
 * the rule ever needs enforcing, it has to be enforced server-side.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi, useSession } from '../../api/hooks';
import type { DocumentAdmin, DocumentVersionAdmin } from '../../api/types';
import { asAdminRole } from './adminNav';
import { DocumentHistory } from './DocumentHistory';
import { DocPill } from './DocumentsPage';
import {
  COLLECTOR_VISIBLE_KINDS,
  isCollectorVisibleKind,
  ownerLockReason,
} from './documentRules';
import { ConfirmDialog, DeskBanner, DeskPage, Picker, type PickItem } from './kit';
import './admin.css';

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { documentsAdmin } = useApi();
  const navigate = useNavigate();
  const { me } = useSession();
  const role = asAdminRole(me?.role);
  const isOwner = role === 'owner';

  const [doc, setDoc] = useState<DocumentAdmin | null>(null);
  const [versions, setVersions] = useState<DocumentVersionAdmin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // draft form state
  const [title, setTitle] = useState('');
  const [ref, setRef] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [fieldsText, setFieldsText] = useState('{}');

  const adopt = useCallback(
    (d: DocumentAdmin) => {
      setDoc(d);
      setTitle(d.title);
      setRef(d.ref ?? '');
      setVisibility((d.visibility as string) ?? 'private');
      setFieldsText(JSON.stringify(d.fields ?? {}, null, 2));
      // the setters are stable; listed because the compiler asks for them
    },
    [setDoc, setTitle, setRef, setVisibility, setFieldsText],
  );

  const loadVersions = useCallback(() => {
    if (!id) return;
    documentsAdmin.versions(id, { per_page: 20 }).then(
      (page) => setVersions(page.results),
      () => undefined,
    );
  }, [documentsAdmin, id]);

  const load = useCallback(() => {
    if (!id) return;
    documentsAdmin
      .document(id)
      .then(adopt, (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the document.'),
      );
    loadVersions();
  }, [documentsAdmin, id, adopt, loadVersions]);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<DocumentAdmin>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      adopt(await fn());
      // an upload snapshots the prior state server-side — keep the list true
      loadVersions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'That did not go through.');
    } finally {
      setBusy(false);
    }
  };

  /** Not `act`: that adopts a returned document into the page, and this
   * leaves the page entirely — there is no record to adopt. */
  const deleteDoc = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await documentsAdmin.deleteDocument(id!);
      navigate('/admin/documents');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete the document.');
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    let fields: Record<string, unknown>;
    try {
      const parsed = JSON.parse(fieldsText) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('not an object');
      }
      fields = parsed as Record<string, unknown>;
    } catch {
      setError('The fields must be a JSON object.');
      return;
    }
    await act(() =>
      documentsAdmin.updateDocument(id!, {
        title: title.trim(),
        ref: ref.trim(),
        visibility,
        fields,
      }),
    );
  };

  const copyLink = async () => {
    if (!doc?.pdf_url) return;
    try {
      await navigator.clipboard.writeText(doc.pdf_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not reach the clipboard — the link is the PDF button above.');
    }
  };

  const [confirming, setConfirming] = useState(false);

  if (!doc) {
    return (
      <DeskPage title="Document">
        {error ? <DeskBanner>{error}</DeskBanner> : <p className="dz-state">Loading…</p>}
      </DeskPage>
    );
  }

  const draft = doc.status === 'draft';
  // services.py:17-19 — the guarded moves, for a standard admin on a locked doc
  const lock = ownerLockReason(doc, role);
  const locked = !!lock;

  return (
    <DeskPage
      title={doc.title}
      action={<DocPill status={doc.status} signed={!!doc.signed_at} />}
      subtitle={
        <>
          <button
            type="button"
            className="ad-ghostbtn"
            onClick={() => navigate('/admin/documents')}
          >
            ← All documents
          </button>
        </>
      }
    >
      {error && <DeskBanner>{error}</DeskBanner>}

      {/* ---- the PDF + lifecycle ---- */}
      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">PDF &amp; lifecycle</h2>
          <span className="ad-dsec-n">
            confirm needs an uploaded PDF and locks the record; sign follows confirmation
            {doc.owner_lock ? ' · owner-locked' : ''}
          </span>
        </div>
        <div className="ad-card ad-reach">
          {lock && (
            <p className="ad-lockline" role="note">
              {lock}
            </p>
          )}
          <div className="ad-reachrow">
            {doc.pdf_url ? (
              <>
                <a className="ad-rowbtn" href={doc.pdf_url} target="_blank" rel="noreferrer">
                  Open PDF
                </a>
                <button type="button" className="ad-rowbtn" onClick={() => void copyLink()}>
                  {copied ? 'Copied ✓' : 'Copy link'}
                </button>
                <span className="ad-cellsub">
                  {doc.visibility === 'public'
                    ? 'a stable public link'
                    : 'a signed link — it expires; copy a fresh one when it does'}
                </span>
              </>
            ) : (
              <span className="ad-cellsub">No PDF yet — upload the rendered document.</span>
            )}
            <label
              className={`ad-rowbtn${locked ? ' is-disabled' : ''}`}
              style={{ cursor: busy || locked ? 'default' : 'pointer' }}
              title={lock ?? undefined}
              aria-disabled={locked || undefined}
            >
              Upload PDF…
              <input
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                disabled={busy || locked}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void act(() => documentsAdmin.uploadPdf(id!, f));
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <div className="ad-reachrow">
            {draft && (
              <button
                type="button"
                className="ad-action"
                disabled={busy || locked || !doc.pdf_url}
                title={lock ?? (doc.pdf_url ? undefined : 'Upload a PDF before confirming.')}
                onClick={() => setConfirming(true)}
              >
                Confirm — lock this document
              </button>
            )}
            {doc.status === 'confirmed' && !doc.signed_at && (
              <button
                type="button"
                className="ad-action"
                disabled={busy || locked}
                title={lock ?? undefined}
                onClick={() => void act(() => documentsAdmin.signDocument(id!))}
              >
                Sign
              </button>
            )}
            {doc.status !== 'archived' && (
              <button
                type="button"
                className="ad-ghostbtn"
                disabled={busy || locked}
                title={lock ?? undefined}
                onClick={() => void act(() => documentsAdmin.archiveDocument(id!))}
              >
                Archive
              </button>
            )}
            {/* `:17913` — owner-only, the old panel's gate (see the header). */}
            {isOwner && (
              <button
                type="button"
                className="ad-ghostbtn is-danger"
                disabled={busy}
                onClick={() => setDeleting(true)}
              >
                Delete
              </button>
            )}
            {doc.confirmed_at && (
              <span className="ad-cellsub">
                Confirmed {new Date(doc.confirmed_at).toLocaleString('en-GB')}
                {doc.signed_at
                  ? ` · signed ${new Date(doc.signed_at).toLocaleString('en-GB')}`
                  : ''}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ---- the record (draft-editable) ---- */}
      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">Record</h2>
          <span className="ad-dsec-n">
            {draft
              ? 'editable while a draft'
              : 'locked — only a draft can be edited (confirm again means a new document)'}
          </span>
        </div>
        <div className="ad-card ad-form">
          <div className="ad-form-grid">
            <label className="ad-field">
              <span className="ad-filter-l">Title</span>
              <input
                value={title}
                disabled={!draft || busy || locked}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="ad-field">
              <span className="ad-filter-l">Reference</span>
              <input
                value={ref}
                disabled={!draft || busy || locked}
                onChange={(e) => setRef(e.target.value)}
              />
            </label>
            <label className="ad-field">
              <span className="ad-filter-l">Kind</span>
              <input value={doc.kind} disabled title="The kind is set at creation." />
            </label>
            <label className="ad-field">
              <span className="ad-filter-l">Visibility</span>
              <select
                value={visibility}
                disabled={!draft || busy || locked}
                onChange={(e) => setVisibility(e.target.value)}
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </label>
          </div>
          <label className="ad-field">
            <span className="ad-filter-l">
              Fields · JSON{' '}
              <span className="ad-subnote">
                — the document's own content; its shape depends on the kind (the Studio, D18,
                will give each kind a real form)
              </span>
            </span>
            <textarea
              className="ad-pastebox"
              rows={8}
              value={fieldsText}
              disabled={!draft || busy || locked}
              onChange={(e) => setFieldsText(e.target.value)}
            />
          </label>
          {draft && (
            <div className="ad-form-a">
              <button
                type="button"
                className="ad-action"
                disabled={busy || locked}
                title={lock ?? undefined}
                onClick={() => void saveDraft()}
              >
                Save draft
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ---- share with the collector (G-DOC-1) ---- */}
      <ShareSection doc={doc} busy={busy} act={act} />

      {/* ---- versions ---- */}
      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">Versions</h2>
          <span className="ad-dsec-n">a snapshot is taken before each new PDF upload</span>
        </div>
        {versions.length === 0 ? (
          <p className="dz-state">No versions yet.</p>
        ) : (
          <div className="ad-card ad-logins">
            {versions.map((v) => (
              <div key={v.id} className="ad-recrow">
                <span className="ad-reck">
                  {new Date(v.created_at).toLocaleString('en-GB')}
                </span>
                <span className="ad-recv">{v.title}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- history (G-DOC-2) ---- */}
      <DocumentHistory docs={documentsAdmin} id={doc.id} version={doc.version} />

      {confirming && (
        <ConfirmDialog
          message={`Confirm “${doc.title}”? The record locks — a confirmed document cannot be edited again${doc.visibility === 'public' ? ', and a public one becomes openly linkable' : ''}.`}
          okLabel="Confirm"
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            void act(() => documentsAdmin.confirmDocument(id!));
          }}
        />
      )}
      {deleting && (
        /* `:17913`, verbatim — including its singular/plural on the count. */
        <ConfirmDialog
          message={`Delete this document and all ${versions.length} version${
            versions.length === 1 ? '' : 's'
          }? A version a gallery already holds cannot be un-sent.`}
          okLabel="Delete"
          danger
          busy={busy}
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            setDeleting(false);
            void deleteDoc();
          }}
        />
      )}
    </DeskPage>
  );
}

/**
 * "Share with collector" — see the header. The pill is the old toggle's own
 * two words (`:12906`); the controls under it are Share (a collector picked)
 * or Stop sharing. The collector's name is read once for a document that
 * already has one, so a shared row says who holds it.
 */
function ShareSection({
  doc,
  busy,
  act,
}: {
  doc: DocumentAdmin;
  busy: boolean;
  act: (fn: () => Promise<DocumentAdmin>) => Promise<void>;
}) {
  const { documentsAdmin, adminAccounts } = useApi();
  const [who, setWho] = useState<PickItem[]>([]);
  const shared = !!doc.shared_at;
  const visible = isCollectorVisibleKind(doc.kind);

  // the document's own collector (a previous share, or an attach from chat)
  useEffect(() => {
    if (!doc.collector) return;
    let alive = true;
    adminAccounts.collector(doc.collector).then(
      (c) => alive && setWho([{ id: c.id, label: c.display_name || 'Collector' }]),
      () => alive && setWho([{ id: doc.collector!, label: 'Collector' }]),
    );
    return () => {
      alive = false;
    };
  }, [adminAccounts, doc.collector]);

  const picked = who[0] ?? null;

  return (
    <section className="ad-dsec" aria-label="Share with collector">
      <div className="ad-dsec-h">
        {/* :6608 — the old share dialog's heading */}
        <h2 className="ad-dsec-t">Share with collector</h2>
        {/* :12912 */}
        <span className="ad-dsec-n">only shared documents appear in their Market App</span>
      </div>
      <div className="ad-card ad-reach">
        {!visible ? (
          /* no old copy — the backend's allow-list (models.py:39-42), flagged */
          <span className="ad-cellsub">
            A “{doc.kind}” document never reaches a collector. Only these kinds can be shared:{' '}
            {COLLECTOR_VISIBLE_KINDS.join(', ').replace(/_/g, ' ')}.
          </span>
        ) : (
          <>
            <div className="ad-reachrow">
              <span className={`ad-stpill is-${shared ? 'ok' : 'neut'}`}>
                {shared ? 'Sharing' : 'Not shared'}
              </span>
              {shared && (
                <span className="ad-cellsub">
                  with {picked?.label ?? 'the collector'} · since{' '}
                  {new Date(doc.shared_at!).toLocaleDateString('en-GB')}
                </span>
              )}
            </div>
            {shared ? (
              <div className="ad-reachrow">
                <button
                  type="button"
                  className="ad-ghostbtn"
                  disabled={busy}
                  onClick={() => void act(() => documentsAdmin.unshareDocument(doc.id))}
                >
                  Stop sharing
                </button>
              </div>
            ) : (
              <>
                <Picker
                  label="Collector"
                  placeholder="Search collectors — name, email, phone…"
                  picked={who}
                  onChange={setWho}
                  single
                  search={async (q) => {
                    const page = await adminAccounts.collectors({ search: q, per_page: 8 });
                    return page.results.map((c) => ({ id: c.id, label: c.display_name }));
                  }}
                />
                <div className="ad-reachrow">
                  <button
                    type="button"
                    className="ad-action"
                    disabled={busy || !picked}
                    title={picked ? undefined : 'Pick the collector first.'}
                    onClick={() =>
                      picked && void act(() => documentsAdmin.shareDocument(doc.id, picked.id))
                    }
                  >
                    Share with collector
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
