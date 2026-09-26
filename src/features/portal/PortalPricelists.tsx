/**
 * PortalPricelists — send Darz a pricelist (gallery-update.html:1034-1068),
 * as a file or built in the portal (`buildOpen`/`renderBuilder`/
 * `buildSubmit`, :1109-1128).
 *
 * Bound to backend P3a/P3b (V1 Phase 5):
 *  - the upload is real multipart into the private documents bucket
 *    (`GalleryPricelistService.submit`); a built list is JSON lines
 *    (`…/pricelists/build/`, `GalleryPricelistService.build`);
 *  - each row shows its server `status` (submitted · accepted · superseded —
 *    labels fall back to the raw value, C-14) and opens its own file through
 *    `file_url` (G-PORT-14).
 *
 * Still different from the old page, for a backend reason:
 *  - the weekly 3-upload quota line is absent — the backend keeps a soft cap
 *    the DESK sees, never a portal-side block (`cap_status`), so "Used this
 *    week: n / 3" would be false;
 *  - the old processing/formatted/rejected states and "Open Darz pricelist ↗"
 *    (the formatted download, P3c) have no backend;
 *  - the builder is always offered (the old `feat_builder` switch has no
 *    field), and its rows are the new line shape: a work (an assigned one, or
 *    a typed title), price, currency, availability (`catalog.availability_
 *    status`, Q-7) and a note. The old Artist / Year / Size (cm) inputs have
 *    no field on a line — flagged.
 */
import { useRef, useState, useSyncExternalStore, useCallback } from 'react';
import type { OptionsMap } from '../../api/services';
import type { PortalPricelist } from '../../api/types';
import type { PortalSession } from './PortalSession';
import {
  MAX_UPLOAD_BYTES,
  blankBuilderLine,
  buildPricelistBody,
  builderLineErrors,
  choices,
  fmtDate,
  fmtThousands,
  pricelistStatusLabel,
  type BuilderLine,
} from './portalForm';

export function PortalPricelists({
  session,
  options,
  notify,
}: {
  session: PortalSession;
  options: OptionsMap | null;
  notify: (m: string) => void;
}) {
  const state = useSyncExternalStore(
    useCallback((fn) => session.subscribe(fn), [session]),
    () => session.getSnapshot(),
  );
  const lists = state.data?.pricelists ?? [];
  const works = state.data?.assigned_artworks ?? [];
  const fileRef = useRef<HTMLInputElement>(null);
  const builderRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [built, setBuilt] = useState<BuilderLine[]>([]);
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({});

  const pick = async (file: File | null | undefined) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      notify('That file is larger than 6 MB — please send a smaller file.');
      return;
    }
    setBusy(true);
    try {
      await session.uploadPricelist(file, file.name || 'Pricelist');
      // reload BEFORE the toast, so "sent" is only said once the list shows it
      await session.reload();
      notify('Pricelist sent to Darz.');
    } catch (err) {
      if (!session.noteAuthFailure(err)) notify('Could not send. Please try again.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const defaultCurrency = choices(options, 'currency')[0]?.value ?? 'USD';
  const buildOpen = () => {
    if (!built.length) setBuilt([blankBuilderLine(defaultCurrency)]);
    requestAnimationFrame(() =>
      builderRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }),
    );
  };
  const setLine = (i: number, patch: Partial<BuilderLine>) =>
    setBuilt((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const buildSubmit = async () => {
    const out = buildPricelistBody(built);
    if (!out.ok) {
      notify(out.error);
      return;
    }
    setBusy(true);
    setLineErrors({});
    try {
      await session.buildPricelist(out.body);
      setBuilt([]);
      await session.reload();
      notify('Pricelist sent to Darz.');
    } catch (err) {
      if (session.noteAuthFailure(err)) return;
      const perLine = builderLineErrors(err, out.index);
      setLineErrors(perLine);
      notify(Object.keys(perLine).length ? 'Some lines need fixing.' : 'Could not send.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="sec-note">
        Send Darz your pricelist (PDF, image, Excel or CSV). Darz extracts, cleans and
        reformats it into the official Darz pricelist — nothing is published automatically.
      </div>
      <button
        type="button"
        className="dropzone"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9A9A9A"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 16V4M6 10l6-6 6 6" />
          <path d="M4 20h16" />
        </svg>
        <span>{busy ? 'Sending…' : 'Tap to upload a pricelist file'}</span>
        <span style={{ fontSize: 11 }}>PDF · image · Excel · CSV · up to ~6 MB</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        aria-label="Pricelist file"
        accept=".pdf,.csv,.xls,.xlsx,image/*,application/pdf"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      {/* old :1044 — the builder's entry, under the dropzone */}
      <button className="btn" type="button" style={{ margin: '0 0 16px' }} onClick={buildOpen}>
        Build a pricelist with the Darz template
      </button>
      <div>
        {lists.length ? (
          lists.map((p) => <PricelistRow key={p.id} p={p} options={options} />)
        ) : (
          <div className="empty">No pricelists sent yet.</div>
        )}
      </div>

      <div ref={builderRef}>
        {built.length > 0 && (
          <>
            <div className="sec-note" style={{ marginTop: 20 }}>
              <b>Build a pricelist</b> — add your works, then submit for Darz to format and
              approve.
            </div>
            {built.map((it, i) => (
              <BuilderRow
                key={i}
                i={i}
                it={it}
                works={works.map((w) => ({
                  id: w.artwork,
                  label: `${w.snapshot.artist || '—'} — ${w.snapshot.title || 'Untitled'}`,
                }))}
                options={options}
                error={lineErrors[i]}
                onSet={(patch) => setLine(i, patch)}
                onRemove={() =>
                  setBuilt((rows) => {
                    const next = rows.filter((_, j) => j !== i);
                    return next.length ? next : [blankBuilderLine(defaultCurrency)];
                  })
                }
              />
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              <button
                className="btn"
                type="button"
                onClick={() =>
                  setBuilt((rows) => [...rows, blankBuilderLine(defaultCurrency)])
                }
              >
                + Add row
              </button>
              <button
                className="btn btn--primary"
                type="button"
                disabled={busy}
                onClick={() => void buildSubmit()}
              >
                {busy ? 'Sending…' : 'Submit pricelist'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** One row — old `plCard` (:1050-1056): the type badge, the name, date and
 * note, then the server status. A built list reads "LIST" and "Pricelist
 * (built in portal)" as in the old card; an upload opens its own file. */
function PricelistRow({ p, options }: { p: PortalPricelist; options: OptionsMap | null }) {
  const isBuilt = !p.object_key && p.lines.length > 0;
  const ext = (p.title || '').split('.').pop() ?? '';
  const ic = isBuilt ? 'LIST' : ext && ext.length <= 4 ? ext.toUpperCase() : 'FILE';
  const st = p.status || 'submitted';
  const count = p.lines.length;
  return (
    <div className="pl-card">
      <div className="pl-ic">{ic}</div>
      <div className="pl-b">
        <div className="pl-name">
          {p.title || (isBuilt ? 'Pricelist (built in portal)' : 'Pricelist')}
        </div>
        <div className="pl-meta">
          {fmtDate(p.created_at)}
          {isBuilt ? ` · ${count} work${count === 1 ? '' : 's'}` : ''}
          {p.notes ? ` · ${p.notes}` : ''}
        </div>
      </div>
      {p.file_url && (
        <div>
          <a className="pl-dl" href={p.file_url} target="_blank" rel="noopener noreferrer">
            Open file ↗
          </a>
        </div>
      )}
      <span className={`pl-status ${st}`}>{pricelistStatusLabel(options, st)}</span>
    </div>
  );
}

function BuilderRow({
  i,
  it,
  works,
  options,
  error,
  onSet,
  onRemove,
}: {
  i: number;
  it: BuilderLine;
  works: Array<{ id: string; label: string }>;
  options: OptionsMap | null;
  error?: string;
  onSet: (patch: Partial<BuilderLine>) => void;
  onRemove: () => void;
}) {
  const currencies = choices(options, 'currency');
  const avail = choices(options, 'catalog.availability_status');
  return (
    <div className="pl-card" style={{ display: 'block' }}>
      <div className="row2">
        <div className="fld">
          <label htmlFor={`bw_${i}`}>Work</label>
          <select
            id={`bw_${i}`}
            value={it.artwork}
            onChange={(e) => onSet({ artwork: e.target.value })}
          >
            <option value="">Another work</option>
            {works.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor={`bt_${i}`}>Title</label>
          <input
            id={`bt_${i}`}
            placeholder={it.artwork ? 'Optional' : 'Artist — title'}
            value={it.title}
            onChange={(e) => onSet({ title: e.target.value })}
          />
        </div>
      </div>
      <div className="row2">
        <div className="fld">
          <label htmlFor={`bp_${i}`}>Price</label>
          <input
            id={`bp_${i}`}
            inputMode="decimal"
            placeholder="e.g. 12,000"
            value={it.price}
            onChange={(e) => onSet({ price: e.target.value })}
            onBlur={(e) => onSet({ price: fmtThousands(e.target.value) })}
          />
        </div>
        <div className="fld">
          <label htmlFor={`bc_${i}`}>Currency</label>
          <select
            id={`bc_${i}`}
            value={it.currency}
            onChange={(e) => onSet({ currency: e.target.value })}
          >
            {currencies.map((c) => (
              <option key={c.value} value={c.value}>
                {c.value}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="row2">
        <div className="fld">
          <label htmlFor={`ba_${i}`}>Availability</label>
          <select
            id={`ba_${i}`}
            value={it.availability}
            onChange={(e) => onSet({ availability: e.target.value })}
          >
            <option value="">—</option>
            {avail.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor={`bn_${i}`}>Note</label>
          <input
            id={`bn_${i}`}
            value={it.note}
            onChange={(e) => onSet({ note: e.target.value })}
          />
        </div>
      </div>
      {error && (
        <div className="pl-err" role="alert">
          {error}
        </div>
      )}
      <button
        className="btn btn--ghost"
        type="button"
        style={{ color: 'var(--red)' }}
        onClick={onRemove}
      >
        Remove row
      </button>
    </div>
  );
}
