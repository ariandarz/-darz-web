/**
 * ImportBatchPage — `/admin/import/:id`, one staged batch under review. The
 * per-row model is the old desk's own: edit a row, reject a row, then
 * **Confirm** runs every non-rejected row through the real artwork-create
 * path — a failing row is marked `error` with the server's validation detail
 * attached and never blocks the rest of the batch. Discard drops the whole
 * staging (never the catalogue; nothing has touched it yet).
 *
 * A row edits as JSON. The staged data is freeform by design (whatever the
 * mapper or the paste produced), so a field-per-key form would be inventing a
 * schema the queue deliberately does not have; the JSON is the honest editor,
 * and the confirm loop is where the real schema (ArtworkAdminSerializer)
 * speaks — through each row's own `error`.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import type { ArtworkImportBatch, ArtworkImportRow } from '../../api/types';
import { ConfirmDialog, DataTable, DeskBanner, type Column } from './kit';
import './admin.css';

export function ImportBatchPage() {
  const { id = '' } = useParams();
  const { catalogAdmin } = useApi();
  const [batch, setBatch] = useState<ArtworkImportBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ArtworkImportRow | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<null | 'confirm' | 'discard'>(null);

  const load = useCallback(() => {
    catalogAdmin.importBatch(id).then(
      (b) => setBatch(b),
      (err: unknown) => setError(err instanceof Error ? err.message : 'Could not load.'),
    );
  }, [catalogAdmin, id]);
  useEffect(load, [load]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The action failed.');
    } finally {
      setBusy(null);
    }
  };

  const saveRow = () => {
    if (!editing) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(draft) as Record<string, unknown>;
    } catch {
      setError('That JSON does not parse.');
      return;
    }
    const row = editing;
    setEditing(null);
    void run(row.id, () => catalogAdmin.updateImportRow(id, row.id, parsed));
  };

  const rows = (batch?.rows ?? []) as ArtworkImportRow[];
  const pending = batch?.status === 'pending';

  const columns: ReadonlyArray<Column<ArtworkImportRow>> = [
    {
      key: 'work',
      header: 'Row',
      cell: (r) => {
        const d = (r.resolved_data ?? {}) as Record<string, unknown>;
        return (
          <>
            <span className="ad-cellmain">{String(d.title ?? '(untitled)')}</span>
            <span className="ad-cellsub">
              {[d.artist_name_raw, d.year, d.price_amount].filter(Boolean).join(' · ')}
            </span>
          </>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <>
          <span className={`ad-chip ad-imp-${r.status}`}>{r.status}</span>
          {r.error ? <span className="ad-cellsub ad-imp-err">{String(r.error)}</span> : null}
        </>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (r) =>
        pending && r.status !== 'rejected' ? (
          <span className="ad-keyacts" aria-busy={busy === r.id || undefined}>
            <button
              type="button"
              className="ad-rowbtn"
              onClick={() => {
                setEditing(r);
                setDraft(JSON.stringify(r.resolved_data ?? {}, null, 2));
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className="ad-rowbtn is-danger"
              onClick={() => void run(r.id, () => catalogAdmin.rejectImportRow(id, r.id))}
            >
              Reject
            </button>
          </span>
        ) : null,
    },
  ];

  return (
    <div className="dz-page ad-page">
      <div className="ad-thread-head">
        <Link to="/admin/import" className="ad-back">
          ← Import
        </Link>
        <div className="ad-thread-who">
          <div className="ad-thread-name">Review batch</div>
          {batch && (
            <div className="ad-thread-sub">
              {batch.source} · {rows.length} row{rows.length === 1 ? '' : 's'} · {batch.status}
            </div>
          )}
        </div>
        <div className="ad-spacer" />
        {pending && (
          <>
            <button
              type="button"
              className="ad-ghostbtn is-danger"
              onClick={() => setConfirming('discard')}
            >
              Discard
            </button>
            <button
              type="button"
              className="ad-action"
              onClick={() => setConfirming('confirm')}
            >
              Confirm into the Database
            </button>
          </>
        )}
      </div>

      {error && <DeskBanner>{error}</DeskBanner>}
      {!batch && !error && <p className="dz-state">Loading…</p>}

      {editing && (
        <div className="ad-card ad-form">
          <div className="ad-form-h">Edit row</div>
          <textarea
            className="ad-pastebox"
            rows={10}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="ad-form-a">
            <button type="button" className="ad-ghostbtn" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="button" className="ad-action" onClick={saveRow}>
              Save row
            </button>
          </div>
        </div>
      )}

      {batch && rows.length > 0 && (
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} label="Batch rows" />
      )}

      {confirming && (
        <ConfirmDialog
          message={
            confirming === 'confirm'
              ? 'Confirm this batch? Every non-rejected row is created in the Database; a row that fails is marked with its error and the rest go through.'
              : 'Discard this batch? The staged rows are dropped. The catalogue is untouched either way.'
          }
          okLabel={confirming === 'confirm' ? 'Confirm' : 'Discard'}
          danger={confirming === 'discard'}
          busy={busy === 'batch'}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const what = confirming;
            setConfirming(null);
            void run('batch', () =>
              what === 'confirm'
                ? catalogAdmin.confirmImportBatch(id)
                : catalogAdmin.discardImportBatch(id),
            );
          }}
        />
      )}
    </div>
  );
}
