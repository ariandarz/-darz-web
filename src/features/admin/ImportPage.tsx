/**
 * ImportPage — `/admin/import` (Artworks group, beside Database),
 * `importView()` (`darz-studio.html:29703`).
 *
 * The desk's rule, verbatim from the old sub-line and kept on screen:
 * *"Imports land in **Review** first — edit, then confirm into the Database.
 * Nothing touches the catalogue until you confirm."*
 *
 * The division of labour is the backend's own (Phase 23): the client parses
 * the source and stages **structured rows**; the server holds the review queue
 * and, on confirm, runs every non-rejected row through the real
 * artwork-create path — a failing row is marked with its error and never
 * blocks the rest.
 *
 * Of the old desk's four intake tiles (CSV file · PDF catalogue · Images ·
 * Paste data, `:29710-29713`), **CSV and Paste ship now** (owner decision
 * D15); PDF needs pdf.js and Images need upload wiring, and a tile that does
 * nothing is worse than a stated absence — so the two absent ones are a line
 * of copy, not dead buttons. CSV opens a column-mapper (`csv.ts` — headers
 * guessed onto `ArtworkAdminSerializer`'s own field names; `artist_name_raw`
 * is what lets a CSV carry the artist as text). Paste accepts CSV rows or a
 * JSON array, the old tile's own promise.
 */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import type { CatalogAdminService } from '../../api/services';
import type { ArtworkImportBatchList, Paginated } from '../../api/types';
import { ListController } from '../shared/ListController';
import { useListController } from '../shared/useListController';
import { CSV_TARGETS, guessMapping, parseCsv, rowsToRecords } from './csv';
import { DeskBanner, DeskList, DeskPage, type Column } from './kit';
import './admin.css';

interface BatchQuery {
  per_page?: number;
  page?: number;
}

class BatchesController extends ListController<ArtworkImportBatchList, BatchQuery> {
  private readonly catalog: CatalogAdminService;
  constructor(catalog: CatalogAdminService) {
    super({});
    this.catalog = catalog;
  }
  protected fetchPage(query: BatchQuery): Promise<Paginated<ArtworkImportBatchList>> {
    return this.catalog.importBatches(query);
  }
}

export function ImportPage() {
  const { catalogAdmin } = useApi();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [csv, setCsv] = useState<{
    headers: string[];
    rows: string[][];
    mapping: string[];
  } | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { state, setPage, reload } = useListController<ArtworkImportBatchList, BatchQuery>(
    () => new BatchesController(catalogAdmin),
  );

  const stage = async (source: string, rows: Array<Record<string, unknown>>) => {
    if (rows.length === 0) {
      setError('Nothing to import — no non-empty rows.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const batch = await catalogAdmin.stageImportBatch(source, rows);
      setCsv(null);
      setPasting(false);
      setPasteText('');
      await reload();
      navigate(`/admin/import/${batch.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not stage the batch.');
    } finally {
      setBusy(false);
    }
  };

  const openCsv = async (file: File) => {
    const rows = parseCsv(await file.text());
    if (rows.length < 2) {
      setError('That CSV has no data rows.');
      return;
    }
    const headers = rows[0];
    setCsv({ headers, rows: rows.slice(1), mapping: guessMapping(headers) });
    setError(null);
  };

  const stagePaste = () => {
    const text = pasteText.trim();
    if (!text) return;
    // the old tile's promise: "CSV rows or JSON"
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text) as unknown;
        if (!Array.isArray(parsed)) throw new Error('not an array');
        void stage(
          'paste',
          parsed.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object'),
        );
        return;
      } catch {
        setError('That JSON did not parse as an array of objects.');
        return;
      }
    }
    const rows = parseCsv(text);
    if (rows.length < 2) {
      setError('Paste a header row plus at least one data row (or a JSON array).');
      return;
    }
    setCsv({ headers: rows[0], rows: rows.slice(1), mapping: guessMapping(rows[0]) });
    setPasting(false);
    setPasteText('');
  };

  const columns: ReadonlyArray<Column<ArtworkImportBatchList>> = [
    {
      key: 'when',
      header: 'Staged',
      className: 'ad-when',
      cell: (b) => new Date(b.created_at).toLocaleString('en-GB'),
    },
    { key: 'source', header: 'Source', cell: (b) => b.source },
    { key: 'rows', header: 'Rows', cell: (b) => b.row_count },
    {
      key: 'status',
      header: 'Status',
      cell: (b) => <span className={`ad-chip ad-imp-${b.status}`}>{b.status}</span>,
    },
    {
      key: 'open',
      header: '',
      cell: (b) => (
        <button
          type="button"
          className="ad-rowbtn"
          onClick={() => navigate(`/admin/import/${b.id}`)}
        >
          Open
        </button>
      ),
    },
  ];

  return (
    <DeskPage wide title="Import artworks">
      {/* :29708, verbatim */}
      <p className="ad-desksub">
        Imports land in <b>Review</b> first — edit, then confirm into the Database. Nothing
        touches the catalogue until you confirm.
      </p>

      <div className="ad-imptiles">
        {/* :29710 — the CSV tile's own copy */}
        <button type="button" className="ad-imptile" onClick={() => fileRef.current?.click()}>
          <span className="ad-cellmain">CSV file</span>
          <span className="ad-cellsub">Airtable export, mapped by column.</span>
        </button>
        {/* :29713 */}
        <button type="button" className="ad-imptile" onClick={() => setPasting(true)}>
          <span className="ad-cellmain">Paste data</span>
          <span className="ad-cellsub">CSV rows or JSON.</span>
        </button>
      </div>
      <p className="ad-cellsub" style={{ marginTop: -6 }}>
        PDF catalogue and image imports follow later (D15) — stated here rather than shown as
        buttons that do nothing.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void openCsv(f);
          e.target.value = '';
        }}
      />

      {error && <DeskBanner>{error}</DeskBanner>}

      {pasting && (
        <div className="ad-card ad-form">
          <div className="ad-form-h">Paste data</div>
          <textarea
            className="ad-pastebox"
            rows={8}
            placeholder={
              'title,artist,price\nUntitled,Fereydoun Ave,12000\n\n…or a JSON array of objects'
            }
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            autoFocus
          />
          <div className="ad-form-a">
            <button type="button" className="ad-ghostbtn" onClick={() => setPasting(false)}>
              Cancel
            </button>
            <button type="button" className="ad-action" disabled={busy} onClick={stagePaste}>
              Review
            </button>
          </div>
        </div>
      )}

      {csv && (
        <div className="ad-card ad-form">
          <div className="ad-form-h">
            Map the columns · {csv.rows.length} row{csv.rows.length === 1 ? '' : 's'}
          </div>
          <div className="ad-maprows">
            {csv.headers.map((h, i) => (
              <label key={`${h}-${i}`} className="ad-field">
                <span className="ad-filter-l">{h || `column ${i + 1}`}</span>
                <select
                  value={csv.mapping[i] ?? ''}
                  onChange={(e) => {
                    const mapping = [...csv.mapping];
                    mapping[i] = e.target.value;
                    setCsv({ ...csv, mapping });
                  }}
                >
                  {CSV_TARGETS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="ad-form-a">
            <button type="button" className="ad-ghostbtn" onClick={() => setCsv(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="ad-action"
              disabled={busy}
              onClick={() => void stage('csv', rowsToRecords(csv.rows, csv.mapping))}
            >
              Stage for review
            </button>
          </div>
        </div>
      )}

      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">Batches</h2>
          <span className="ad-dsec-n">the review queue</span>
        </div>
        <DeskList
          label="Import batches"
          status={state.status}
          error={state.error}
          rows={state.results}
          pagination={state.pagination}
          onPage={setPage}
          columns={columns}
          rowKey={(b) => b.id}
          empty="No batches yet — stage a CSV or a paste above."
        />
      </section>
    </DeskPage>
  );
}
