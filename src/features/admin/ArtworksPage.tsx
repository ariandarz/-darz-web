/**
 * ArtworksPage — `/admin/artworks`, the Artworks Database (`databaseView()`,
 * `darz-studio.html:26605`) — the panel's biggest desk, over backend Phase
 * 7's admin catalogue CRUD.
 *
 * Ported content:
 *  - the title and the "＋ New artwork" action (`:26770`);
 *  - the toolbar's shape (`:26661-26668`): one search box, then the filter
 *    dropdowns, then every ACTIVE filter as a removable dark chip with
 *    "Clear all" (`:26686`) — here the kit's `FilterChips`;
 *  - the row anatomy (`:26756`): artist · title, year · id · the status
 *    pill (`_statusPill`, `:26500` — "Status by Darz — this is what
 *    collectors see"), and the Market App checkbox-button (`dbAppBox`,
 *    `:23957` — ✓ APP) wired to the real per-work publish/unpublish;
 *  - the empty copy "No artworks match these filters." (`:26764`);
 *  - Edit / Remove per row (`:26762`), Remove soft-deletes after a confirm.
 *
 * The search placeholder names what the server really searches — artist,
 * title, medium, dimensions — not the old promise of ID/source (`:26661`),
 * which this API's `search` does not cover.
 *
 * **Not ported, stated (hybrid rule + gaps):**
 *  - thumbnails — the admin list row carries no images (G-CAT-1), so the
 *    Work cell is textual; images live on the editor;
 *  - the Year / Source / "Market App: shown|hidden" filters — no server
 *    param (G-CAT-2);
 *  - bulk selection & its action groups (`:26723`) — documents, auctions
 *    and portals are later phases; a bar of dead buttons is worse than a
 *    stated absence (the D15 rule). Bulk status/publish returns with it;
 *  - gallery/cards view toggle and custom columns (`:26649`) — device-local
 *    column config was the old app's own; one good table first, views later;
 *  - the sold-by / provider lane (§75) — the gallery-portal phase's.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { ArtistAdmin, ArtworkAdmin, ArtworkAdminQuery, Choice } from '../../api/types';
import { useListController } from '../shared/useListController';
import { ArtworksController } from './ArtworksController';
import {
  ConfirmDialog,
  DeskAction,
  DeskBanner,
  DeskList,
  DeskPage,
  FilterChips,
  SearchFilter,
  SelectFilter,
  type ActiveChip,
  type Column,
} from './kit';
import './admin.css';

/** The old sort list's survivors — the tokens this API serves (`:26663` had
 * ten; complete/size/width/height ranked client-side fields that no longer
 * exist server-side). No token = newest published first. */
const SORTS: Choice[] = [
  { value: 'artist', label: 'Artist A–Z' },
  { value: '-artist', label: 'Artist Z–A' },
  { value: '-year', label: 'Year newest' },
  { value: 'year', label: 'Year oldest' },
  { value: '-price', label: 'Price high→low' },
  { value: 'price', label: 'Price low→high' },
];

export function ArtworksPage() {
  const { catalogAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();

  const { state, setQuery, setPage, reload } = useListController<
    ArtworkAdmin,
    ArtworkAdminQuery
  >(() => new ArtworksController(catalogAdmin));

  // The artists roster, fetched once: resolves artist uuids to names on the
  // rows (G-CAT-1 — the list row carries no artist object) and feeds the
  // Artist filter. The roster endpoint takes no search (G-CAT-3), so one
  // large page is the practical whole.
  const [artists, setArtists] = useState<ArtistAdmin[]>([]);
  useEffect(() => {
    let alive = true;
    catalogAdmin.artists({ per_page: 500 }).then(
      (page) => alive && setArtists(page.results),
      () => alive && setArtists([]),
    );
    return () => {
      alive = false;
    };
  }, [catalogAdmin]);
  const artistName = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of artists) map.set(a.id, a.display_name);
    return map;
  }, [artists]);

  const statuses = choices(options, 'catalog.availability_status');
  const priceTypes = choices(options, 'catalog.price_type');
  const currencies = choices(options, 'currency');

  const [deleting, setDeleting] = useState<ArtworkAdmin | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /** The old `togglePub` — the per-row ✓ APP button, on the real per-work
   * publish/unpublish endpoints. */
  const togglePublish = async (w: ArtworkAdmin) => {
    if (busyId) return;
    setBusyId(w.id);
    setActionError(null);
    try {
      if (w.is_published) await catalogAdmin.unpublishArtwork(w.id);
      else await catalogAdmin.publishArtwork(w.id);
      await reload();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Could not change publication.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (w: ArtworkAdmin) => {
    setActionError(null);
    try {
      await catalogAdmin.deleteArtwork(w.id);
      await reload();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Could not remove the artwork.');
    }
  };

  const nameOf = (w: ArtworkAdmin) =>
    (w.artist && artistName.get(w.artist)) || w.artist_name_raw || '';

  const columns: ReadonlyArray<Column<ArtworkAdmin>> = [
    {
      key: 'work',
      header: 'Work',
      cell: (w) => (
        <button
          type="button"
          className="ad-worklink"
          title="Open & edit"
          onClick={() => navigate(`/admin/artworks/${w.id}`)}
        >
          {/* :26756 — artist · title, year · id · status pill */}
          <span className="ad-cellmain">{nameOf(w) || '—'}</span>
          <span className="ad-cellsub">
            {w.title}
            {w.year ? `, ${w.year}` : ''}
          </span>
          <span className="ad-workid">{w.id.slice(0, 8)}</span>
          <StatusPill
            status={w.availability_status}
            label={label(statuses, w.availability_status)}
          />
        </button>
      ),
    },
    {
      key: 'app',
      header: 'Market App',
      cell: (w) => (
        <button
          type="button"
          className={`ad-appck${w.is_published ? ' on' : ''}`}
          aria-pressed={w.is_published}
          disabled={busyId === w.id}
          title={
            w.is_published
              ? 'Shown in the Market App — tap to remove'
              : 'Hidden from the Market App — tap to add'
          }
          onClick={() => void togglePublish(w)}
        >
          <span className="ad-appck-bx">{w.is_published ? '✓' : ''}</span>APP
        </button>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      cell: (w) =>
        w.price_type === 'on_request' ? (
          <span className="ad-cellsub">On request</span>
        ) : w.price_amount ? (
          <>
            <span className="ad-cellmain">
              {Number(w.price_amount).toLocaleString('en-US')} {w.currency ?? ''}
            </span>
            {w.price_type === 'estimate' && <span className="ad-cellsub">estimate</span>}
          </>
        ) : (
          '—'
        ),
    },
    { key: 'medium', header: 'Medium', cell: (w) => w.medium || '—' },
    { key: 'dims', header: 'Dimensions', cell: (w) => w.dimensions || '—' },
    {
      key: 'visibility',
      header: 'Visibility',
      cell: (w) => label(choices(options, 'catalog.visibility'), w.visibility ?? '') || '—',
    },
    {
      key: 'edit',
      header: '',
      cell: (w) => (
        <span className="ad-rowacts">
          <button
            type="button"
            className="ad-rowbtn"
            onClick={() => navigate(`/admin/artworks/${w.id}`)}
          >
            Edit
          </button>
          <button type="button" className="ad-rowbtn is-danger" onClick={() => setDeleting(w)}>
            Remove
          </button>
        </span>
      ),
    },
  ];

  const q = state.query;
  const chips: ActiveChip[] = [];
  if (q.search)
    chips.push({
      key: 'search',
      label: `“${q.search}”`,
      onClear: () => setQuery({ search: undefined }),
    });
  if (q.artist)
    chips.push({
      key: 'artist',
      label: `Artist: ${artistName.get(q.artist) ?? 'selected'}`,
      onClear: () => setQuery({ artist: undefined }),
    });
  if (q.availability_status)
    chips.push({
      key: 'status',
      label: `Status: ${label(statuses, q.availability_status)}`,
      onClear: () => setQuery({ availability_status: undefined }),
    });
  if (q.price_type)
    chips.push({
      key: 'price_type',
      label: `Price: ${label(priceTypes, q.price_type)}`,
      onClear: () => setQuery({ price_type: undefined }),
    });
  if (q.currency)
    chips.push({
      key: 'currency',
      label: `Currency: ${label(currencies, q.currency)}`,
      onClear: () =>
        setQuery({
          currency: undefined,
          ordering: priceSort(q.ordering) ? undefined : q.ordering,
        }),
    });
  if (q.medium)
    chips.push({
      key: 'medium',
      label: `Medium: ${q.medium}`,
      onClear: () => setQuery({ medium: undefined }),
    });

  return (
    <DeskPage
      title="Artworks Database"
      action={
        <DeskAction onClick={() => navigate('/admin/artworks/new')}>＋ New artwork</DeskAction>
      }
      toolbar={
        <>
          <SearchFilter
            label="Search"
            value={q.search}
            onChange={(search) => setQuery({ search })}
            placeholder="Search artworks — artist, title, medium, dimensions…"
          />
          <SelectFilter
            label="Artist"
            anyLabel="All Artists"
            value={q.artist}
            onChange={(artist) => setQuery({ artist })}
            choices={artists.map((a) => ({ value: a.id, label: a.display_name }))}
          />
          <SelectFilter
            label="Status"
            anyLabel="All Status"
            value={q.availability_status}
            onChange={(availability_status) => setQuery({ availability_status })}
            choices={statuses}
          />
          <SelectFilter
            label="Price type"
            anyLabel="All price types"
            value={q.price_type}
            onChange={(price_type) => setQuery({ price_type })}
            choices={priceTypes}
          />
          <SelectFilter
            label="Currency"
            anyLabel="All Currencies"
            value={q.currency}
            onChange={(currency) => setQuery({ currency })}
            choices={currencies}
          />
          <SelectFilter
            label="Sort"
            anyLabel="Recent"
            value={q.ordering}
            onChange={(ordering) => setQuery({ ordering })}
            // "Sort by price only within one currency" — the API's own rule
            // (Toman and USD amounts don't compare); the price sorts appear
            // once a currency is filtered.
            choices={q.currency ? SORTS : SORTS.filter((s) => !priceSort(s.value))}
          />
        </>
      }
    >
      <FilterChips
        chips={chips}
        onClearAll={() =>
          setQuery({
            search: undefined,
            artist: undefined,
            availability_status: undefined,
            price_type: undefined,
            currency: undefined,
            medium: undefined,
            ordering: undefined,
          })
        }
      />

      {actionError && <DeskBanner>{actionError}</DeskBanner>}

      <DeskList
        label="Artworks"
        status={state.status}
        error={state.error}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(w) => w.id}
        empty="No artworks match these filters."
      />

      {deleting && (
        <ConfirmDialog
          message={`Remove “${deleting.title || 'this artwork'}”? It leaves the Database and the Market App. The record is kept (never hard-deleted) — restoring it is a backend operation.`}
          okLabel="Remove"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const w = deleting;
            setDeleting(null);
            void remove(w);
          }}
        />
      )}
    </DeskPage>
  );
}

/** `_statusPill` (`:26500`) — tone classes ok / res / gone / neut from
 * `_stCls` (`:26498`): available→ok, reserved→res,
 * sold/withdrawn/archived→gone, anything else (on_hold)→neut. The title is
 * the old pill's own. */
export function StatusPill({ status, label: text }: { status: string; label: string }) {
  const gone = ['sold', 'withdrawn', 'archived'];
  const cls =
    status === 'available'
      ? 'ok'
      : status === 'reserved'
        ? 'res'
        : gone.includes(status)
          ? 'gone'
          : 'neut';
  return (
    <span
      className={`ad-stpill is-${cls}`}
      title="Status by Darz — this is what collectors see"
    >
      {text || status}
    </span>
  );
}

function priceSort(token: string | undefined): boolean {
  return token === 'price' || token === '-price';
}

function choices(options: OptionsMap | null, key: string): Choice[] {
  return (options?.[key] as Choice[] | undefined) ?? [];
}

function label(list: Choice[], value: string): string {
  return list.find((c) => c.value === value)?.label ?? value;
}
