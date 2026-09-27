/**
 * ExhibitionCatalogPage — `/admin/exhibition-catalogue`, the Exhibition
 * Services menu every portal shows before Darz composes a show (G-PORT-12b,
 * `/gallery/admin/exhibition-catalogue/`).
 *
 * Ported from the old passport's "Exhibition Services — portal control"
 * section (`galExhSection`, `darz-studio.html:27843-27920`): the "Service
 * checklist" of rows — service · short description · price · ✕ — with
 * "+ Add service", and "Leave a price empty to quote that service on
 * request". What changed with the backend:
 *  - ONE menu for every portal, not a list per gallery: the table the portal's
 *    catalogue endpoint reads (active rows only). So the old standard-vs-custom
 *    banner, "Reset to Darz default", the per-gallery currency select and the
 *    portal-text fields do not port — there is nothing per gallery to reset
 *    or override (flagged);
 *  - each row has a stable `key` (read-only once created), a `position` and an
 *    on/off switch (`is_active` — off hides it from the portal's menu without
 *    deleting it). None has an old control: they are the table's own fields;
 *  - a row saves on its own Save (a locked PATCH with `expected_version`); a
 *    409 is the kit's ConflictBanner, not an error. The old page autosaved
 *    each field and pushed the list with "Save & sync to portal";
 *  - prices are Toman, as the seeded menu (`exhibition_catalogue.py`); the
 *    item has no currency field, so the column says T.
 */
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '../../api/hooks';
import type { ExhibitionCatalogItem, Paginated } from '../../api/types';
import { ValidationError } from '../../api/errors';
import {
  ConfirmDialog,
  ConflictBanner,
  DeskAction,
  DeskBanner,
  DeskPage,
  DeskSave,
  DeskToast,
  Pager,
  isConflict,
  useDeskToast,
} from './kit';
import { curSym, fmtThousands } from '../portal/portalForm';
import './admin.css';

const PER_PAGE = 25;
const SYM = curSym('TMN').trim();

interface RowDraft {
  title: string;
  description: string;
  price: string;
  position: string;
}

const draftOf = (r: ExhibitionCatalogItem): RowDraft => ({
  title: r.title,
  description: r.description ?? '',
  price:
    r.default_price === null || r.default_price === undefined || r.default_price === ''
      ? ''
      : fmtThousands(String(Math.round(Number(r.default_price)))),
  position: String(r.position ?? 0),
});

/** '' → null ("on request"); separators stripped for the DecimalField. */
function priceOut(v: string): string | null {
  const s = v.replace(/[,\s ٬]/g, '');
  return s === '' ? null : s;
}

function errorText(err: unknown, fallback: string): string {
  if (err instanceof ValidationError) {
    const parts = Object.entries(err.fields).map(([k, v]) => `${k}: ${v.join(' ')}`);
    return parts.length ? parts.join(' · ') : err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

export function ExhibitionCatalogPage() {
  const { galleryAdmin } = useApi();
  const { say, message } = useDeskToast();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<ExhibitionCatalogItem> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<ExhibitionCatalogItem | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      galleryAdmin.exhibitionCatalogue({ page, per_page: PER_PAGE }).then(
        (p) => {
          setData(p);
          setError(null);
        },
        (err: unknown) => setError(errorText(err, 'Could not load the services.')),
      ),
    [galleryAdmin, page],
  );
  useEffect(() => {
    void load();
  }, [load]);

  /** A locked write; a 409 turns into the banner and the list re-reads. */
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setConflict(false);
      say(done);
      await load();
    } catch (err) {
      if (isConflict(err)) setConflict(true);
      else setError(errorText(err, 'That did not save.'));
      throw err; // DeskSave must not flash "Saved" on a failed write
    } finally {
      setBusy(false);
    }
  };

  const rows = data?.results ?? [];

  return (
    <DeskPage
      title="Service checklist"
      action={<DeskAction onClick={() => setAdding(true)}>+ Add service</DeskAction>}
      subtitle={
        <>
          The Exhibition Services list every gallery sees in its portal: add, rename, reprice
          or turn a service off. Leave a price empty to quote that service on request. Build
          and save their exhibition packages in Sources → Exhibitions.
        </>
      }
    >
      {conflict && <ConflictBanner noun="service" onReload={() => void load()} />}
      {error && <DeskBanner>{error}</DeskBanner>}

      {adding && (
        <AddForm
          busy={busy}
          nextPosition={
            (data?.pagination.total_count ?? rows.length) > 0
              ? Math.max(0, ...rows.map((r) => r.position ?? 0)) + 1
              : 0
          }
          onCancel={() => setAdding(false)}
          onSave={(body) =>
            run(
              () => galleryAdmin.createExhibitionCatalogueItem(body),
              'Service added ✓',
            ).then(() => setAdding(false))
          }
        />
      )}

      {!data && !error && <p className="dz-state">Loading…</p>}
      {data && rows.length === 0 && (
        <p className="dz-state">No services yet — add the first with + Add service.</p>
      )}

      {rows.length > 0 && (
        <div className="ad-card ad-gxe-card">
          <div className="ad-gxe-head" aria-hidden>
            <span>Service</span>
            <span>Short description</span>
            <span>Price</span>
            <span>Order</span>
            <span />
          </div>
          {rows.map((r) => (
            <CatalogRow
              key={`${r.id}:${r.version}`}
              row={r}
              busy={busy}
              onSave={(d) =>
                run(
                  () =>
                    galleryAdmin.updateExhibitionCatalogueItem(r.id, {
                      title: d.title.trim(),
                      description: d.description.trim(),
                      default_price: priceOut(d.price),
                      position: Math.max(0, Math.floor(Number(d.position) || 0)),
                      expected_version: r.version,
                    }),
                  'Saved ✓',
                )
              }
              onToggle={() =>
                void run(
                  () =>
                    galleryAdmin.updateExhibitionCatalogueItem(r.id, {
                      is_active: !(r.is_active ?? true),
                      expected_version: r.version,
                    }),
                  r.is_active === false
                    ? 'Back in the portal menu ✓'
                    : 'Hidden from the portal ✓',
                ).catch(() => undefined)
              }
              onRemove={() => setRemoving(r)}
            />
          ))}
        </div>
      )}
      {data && <Pager pagination={data.pagination} onPage={setPage} />}

      {removing && (
        <ConfirmDialog
          message={`Delete “${removing.title}” from the menu? Shows already composed keep their own copy of the line. To stop offering it for now, turn it off instead.`}
          okLabel="Delete"
          danger
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const r = removing;
            setRemoving(null);
            void run(
              () => galleryAdmin.deleteExhibitionCatalogueItem(r.id),
              'Service deleted',
            ).catch(() => undefined);
          }}
        />
      )}
      <DeskToast message={message} />
    </DeskPage>
  );
}

/** One row — the old `.gxe-row` (title · description · price · ✕), with the
 * key read-only under the title and the table's order + on/off beside it. */
function CatalogRow({
  row,
  busy,
  onSave,
  onToggle,
  onRemove,
}: {
  row: ExhibitionCatalogItem;
  busy: boolean;
  onSave: (d: RowDraft) => Promise<unknown>;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [d, setD] = useState<RowDraft>(() => draftOf(row));
  const orig = draftOf(row);
  const dirty =
    d.title !== orig.title ||
    d.description !== orig.description ||
    priceOut(d.price) !== priceOut(orig.price) ||
    d.position !== orig.position;
  const off = row.is_active === false;
  return (
    <div className={`ad-gxe-row${off ? ' is-off' : ''}`}>
      <div className="ad-gxe-t">
        <input
          aria-label="Service"
          placeholder="Service"
          value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })}
        />
        <span className="ad-gxe-key" title="The service's stable key — fixed once created">
          {row.key}
          {off ? ' · off' : ''}
        </span>
      </div>
      <input
        className="ad-gxe-d"
        aria-label="Short description"
        placeholder="Short description"
        value={d.description}
        onChange={(e) => setD({ ...d, description: e.target.value })}
      />
      <div className="ad-gxe-price">
        <span>{SYM}</span>
        <input
          aria-label="Price"
          inputMode="decimal"
          placeholder="On request"
          value={d.price}
          onChange={(e) => setD({ ...d, price: e.target.value })}
          onBlur={(e) => setD({ ...d, price: fmtThousands(e.target.value) })}
        />
      </div>
      <input
        className="ad-gxe-pos"
        aria-label="Order"
        inputMode="numeric"
        value={d.position}
        onChange={(e) => setD({ ...d, position: e.target.value })}
      />
      <span className="ad-rowacts">
        {dirty && (
          <DeskSave
            className="ad-rowbtn is-primary"
            busy={busy}
            disabled={!d.title.trim()}
            onClick={() => onSave(d)}
          />
        )}
        <button type="button" className="ad-rowbtn" disabled={busy} onClick={onToggle}>
          {off ? 'Turn on' : 'Turn off'}
        </button>
        <button
          type="button"
          className="ad-rowbtn is-danger"
          title="Remove this service"
          disabled={busy}
          onClick={onRemove}
        >
          ✕
        </button>
      </span>
    </div>
  );
}

function AddForm({
  busy,
  nextPosition,
  onSave,
  onCancel,
}: {
  busy: boolean;
  nextPosition: number;
  onSave: (body: {
    key: string;
    title: string;
    description: string;
    default_price: string | null;
    position: number;
    is_active: boolean;
  }) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [key, setKey] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [position, setPosition] = useState(String(nextPosition));
  const [active, setActive] = useState(true);
  // the key defaults from the title (the seed's own snake_case keys) until typed
  const [keyTouched, setKeyTouched] = useState(false);
  const autoKey = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  const k = keyTouched ? key : autoKey;
  return (
    <div className="ad-card ad-form">
      <div className="ad-form-h">Add a service to the menu</div>
      <div className="ad-form-grid">
        <label className="ad-field">
          <span className="ad-filter-l">Service</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Key · fixed once saved</span>
          <input
            value={k}
            onChange={(e) => {
              setKeyTouched(true);
              setKey(e.target.value);
            }}
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Short description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Price ({SYM}) · empty = on request</span>
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onBlur={(e) => setPrice(fmtThousands(e.target.value))}
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Order</span>
          <input
            inputMode="numeric"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
        </label>
        <label className="ad-actck">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Shown in the portal menu
        </label>
      </div>
      <div className="ad-form-a">
        <button type="button" className="ad-ghostbtn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="ad-action"
          disabled={busy || !title.trim() || !k.trim()}
          onClick={() =>
            void onSave({
              key: k.trim(),
              title: title.trim(),
              description: description.trim(),
              default_price: priceOut(price),
              position: Math.max(0, Math.floor(Number(position) || 0)),
              is_active: active,
            }).catch(() => undefined)
          }
        >
          Add service
        </button>
      </div>
    </div>
  );
}
