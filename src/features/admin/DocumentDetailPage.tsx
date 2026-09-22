/**
 * DocumentDetailPage — `/admin/documents/:id`: one document's record, its
 * content fields, its PDF and its lifecycle.
 *
 * The lifecycle is the backend's own (Phase 11): a DRAFT is editable
 * (title · ref · visibility · the freeform `fields` JSON); **Confirm needs
 * an uploaded PDF first** and locks the record; **Sign** follows
 * confirmation; **Archive** shelves it. `owner_lock` limits the guarded
 * moves to the owner — the server enforces it, the desk shows it.
 *
 * Sharing (the owner's ask, D19 / G-DOC-1): there is no way to attach a
 * document to a collector thread yet, so the desk offers the direct
 * `pdf_url` — **Copy link** — which is a signed, expiring URL for a private
 * document and a stable one for a public document. The public kinds also
 * serve at `GET /api/documents/public/{kind}/` once confirmed.
 *
 * The `fields` editor is the Import batch page's JSON-editor pattern: the
 * shape depends on `kind` and the model keeps it freeform, so a validated
 * JSON textarea is the honest editor until the Studio (D18) gives each kind
 * its form.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import type { DocumentAdmin, DocumentVersionAdmin } from '../../api/types';
import { DocPill } from './DocumentsPage';
import { ConfirmDialog, DeskBanner, DeskPage } from './kit';
import './admin.css';

export function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { documentsAdmin } = useApi();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<DocumentAdmin | null>(null);
  const [versions, setVersions] = useState<DocumentVersionAdmin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // draft form state
  const [title, setTitle] = useState('');
  const [ref, setRef] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [fieldsText, setFieldsText] = useState('{}');

  const adopt = useCallback((d: DocumentAdmin) => {
    setDoc(d);
    setTitle(d.title);
    setRef(d.ref ?? '');
    setVisibility((d.visibility as string) ?? 'private');
    setFieldsText(JSON.stringify(d.fields ?? {}, null, 2));
  }, []);

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
            <label className="ad-rowbtn" style={{ cursor: busy ? 'default' : 'pointer' }}>
              Upload PDF…
              <input
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                disabled={busy}
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
                disabled={busy || !doc.pdf_url}
                title={doc.pdf_url ? undefined : 'Upload a PDF before confirming.'}
                onClick={() => setConfirming(true)}
              >
                Confirm — lock this document
              </button>
            )}
            {doc.status === 'confirmed' && !doc.signed_at && (
              <button
                type="button"
                className="ad-action"
                disabled={busy}
                onClick={() => void act(() => documentsAdmin.signDocument(id!))}
              >
                Sign
              </button>
            )}
            {doc.status !== 'archived' && (
              <button
                type="button"
                className="ad-ghostbtn"
                disabled={busy}
                onClick={() => void act(() => documentsAdmin.archiveDocument(id!))}
              >
                Archive
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
                disabled={!draft || busy}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="ad-field">
              <span className="ad-filter-l">Reference</span>
              <input
                value={ref}
                disabled={!draft || busy}
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
                disabled={!draft || busy}
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
              disabled={!draft || busy}
              onChange={(e) => setFieldsText(e.target.value)}
            />
          </label>
          {draft && (
            <div className="ad-form-a">
              <button
                type="button"
                className="ad-action"
                disabled={busy}
                onClick={() => void saveDraft()}
              >
                Save draft
              </button>
            </div>
          )}
        </div>
      </section>

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
    </DeskPage>
  );
}
