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
 *  - the row anatomy (`:26755`): the thumbnail (`adThumbImg(w,'ad-th',140)`,
 *    an empty grey box when the work has no image), then artist · title,
 *    year · id · the status pill (`_statusPill`, `:26500` — "Status by Darz —
 *    this is what collectors see"), and the Market App checkbox-button
 *    (`dbAppBox`, `:23957` — ✓ APP) wired to the real per-work
 *    publish/unpublish. Thumb and artist come straight off the row since
 *    G-CAT-1 (`thumb`, `artist_name`) — no roster name map;
 *  - the publish refusal (`togglePub`, `:41959`): the old "isn’t ready for the
 *    Market App yet — Please complete: …" popup with "Complete it now" / "Not
 *    now", its list read from the gate's `details.missing` (C-10);
 *  - the empty copy "No artworks match these filters." (`:26764`);
 *  - Edit / Remove per row (`:26762`), Remove soft-deletes after a confirm.
 *
 * The search placeholder names what the server really searches — artist,
 * title, medium, dimensions — not the old promise of ID/source (`:26661`),
 * which this API's `search` does not cover.
 *
 * **Opening filtered.** A tile elsewhere (Dashboard catalogue, Data Health)
 * opens this desk through `databaseLink()` — the old `dbGo({…})` (`:38120`) —
 * and the desk reads its opening filters from the URL once
 * (`artworkQueryFromParams`), as the Requests desk does.
 *
 * **Not ported, stated (hybrid rule + gaps):**
 *  - the per-portal entries of the Gallery Portal select (`:26678`) — the API
 *    filters "in any portal / not in a portal" only (`gallery_portal`);
 *  - four of the Details select's five picks (`:26683`) and the size
 *    select's Oversized / Bigger / Smaller / custom range (`:26685`) — no
 *    server filter; the three size buckets are the backend's (≤ 50 · 50–120 ·
 *    > 120 cm, owner decision 2026-09-24), not the old 40/100/200;
 *  - "Chosen by Darz" (`:26680`) and "All Categories" (`:26673`) — no field;
 *  - `source_type` and `created_after` have no old dropdown (the old desk
 *    reached "recently added" only from the Data Health tile, as the "Latest 50
 *    added" chip, `:26717`) — so here they are chips a link sets, never a
 *    select; the chip reads "Added since <date>" (the old "Latest 50" was a
 *    count, this filter is a date);
 *  - bulk selection & its action groups (`:26723`) — documents, auctions
 *    and portals are later phases; a bar of dead buttons is worse than a
 *    stated absence (the D15 rule). Bulk status/publish returns with it;
 *  - gallery/cards view toggle and custom columns (`:26649`) — device-local
 *    column config was the old app's own; one good table first, views later;
 *  - the sold-by / provider lane (§75) — the gallery-portal phase's.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type {
  ArtistAdmin,
  ArtworkAdmin,
  ArtworkAdminQuery,
  ArtworkFacets,
  Choice,
} from '../../api/types';
import { useListController } from '../shared/useListController';
import { EMPTY_FACETS, normaliseFacets } from './artworkFacets';
import {
  DETAILS_CHOICES,
  IMAGES_CHOICES,
  PORTAL_CHOICES,
  SIZE_CHOICES,
  addedSinceChip,
  artworkQueryFromParams,
  boolFrom,
  boolPick,
  imagesPatch,
  imagesPick,
  publishMissing,
  sizeChip,
} from './artworkQuery';
import { PublishRefusal } from './PublishRefusal';
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
import { MAX_PER_PAGE, walkPages } from '../../api/paging';

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
  // The opening filter comes from the URL (a tile's `databaseLink`), read
  // once as the controller's initial query — after that the controller owns it.
  const [params] = useSearchParams();

  const { state, setQuery, setPage, reload } = useListController<
    ArtworkAdmin,
    ArtworkAdminQuery
  >(() => new ArtworksController(catalogAdmin, artworkQueryFromParams(params)));

  // The artists roster, fetched once, for the Artist filter's options and its
  // chip (rows carry `artist_name` since G-CAT-1, so no name map for them).
  // Walked whole — `per_page` is clamped to 100 (C-5); the old dropdown listed
  // every artist (`dbUniq(all,'artist')`, `:26666`).
  const [artists, setArtists] = useState<ArtistAdmin[]>([]);
  useEffect(() => {
    let alive = true;
    walkPages((page) => catalogAdmin.artists({ page, per_page: MAX_PER_PAGE })).then(
      (all) => alive && setArtists(all),
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
  /** The publish gate's refusal — the work and its missing essentials. */
  const [refused, setRefused] = useState<{ id: string; items: string[] } | null>(null);

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
      // G-CAT-8: a 400 whose `details.missing` names what the listing lacks —
      // the old popup, not the flattened "Validation failed: …" string.
      const missing = publishMissing(err);
      if (missing) setRefused({ id: w.id, items: missing });
      else
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

  const nameOf = (w: ArtworkAdmin) => w.artist_name || w.artist_name_raw || '';

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
          {/* :26755 — the thumb, then artist · title, year · id · status pill */}
          <span className="ad-wc">
            {w.thumb ? (
              <img className="ad-th" src={w.thumb} alt="" loading="lazy" decoding="async" />
            ) : (
              <span className="ad-th" aria-hidden="true" />
            )}
            <span className="ad-wc-t">
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
            </span>
          </span>
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
  /* The Year and Source vocabularies. Re-read whenever the query changes,
     because the endpoint computes them over the same filtered queryset — so
     picking a source narrows the Year list to that source's years, the way
     the old desk's client-side `dbUniq` did over the whole library. The query
     is serialised as the dependency so an identical re-render does not refetch. */
  const [facets, setFacets] = useState<ArtworkFacets>(EMPTY_FACETS);
  const facetKey = JSON.stringify(q);
  useEffect(() => {
    let alive = true;
    catalogAdmin.artworkFacets(q).then(
      // `normaliseFacets`, not the raw body: a 200 with the wrong shape used
      // to throw during render and take the whole desk down, blank. See its
      // module docstring.
      (f) => alive && setFacets(normaliseFacets(f)),
      // A desk that lists fine but cannot offer a dropdown is still usable;
      // an error banner over a working table would not be.
      () => alive && setFacets(EMPTY_FACETS),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- facetKey IS q
  }, [catalogAdmin, facetKey]);

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
  if (q.year)
    chips.push({
      key: 'year',
      label: `Year: ${q.year}`,
      onClear: () => setQuery({ year: undefined }),
    });
  if (q.source)
    chips.push({
      key: 'source',
      label: `Source: ${q.source}`,
      onClear: () => setQuery({ source: undefined }),
    });
  if (q.published !== undefined)
    chips.push({
      key: 'published',
      label: q.published ? 'In the app' : 'Not in the app',
      onClear: () => setQuery({ published: undefined }),
    });
  const img = imagesPick(q);
  if (img)
    chips.push({
      key: 'images',
      // :26712 — "Duplicates (same image)" / "With images" / "Without images"
      label: IMAGES_CHOICES.find((c) => c.value === img)!.label,
      onClear: () => setQuery(imagesPatch(undefined)),
    });
  if (q.gallery_portal !== undefined)
    chips.push({
      key: 'gallery_portal',
      // :26710 — "Portal: any" / "Portal: none"
      label: q.gallery_portal ? 'Portal: any' : 'Portal: none',
      onClear: () => setQuery({ gallery_portal: undefined }),
    });
  if (q.complete !== undefined)
    chips.push({
      key: 'complete',
      // :26713 — the Details pick's own words
      label: q.complete ? 'Complete records' : 'Missing required fields',
      onClear: () => setQuery({ complete: undefined }),
    });
  if (q.size)
    chips.push({
      key: 'size',
      label: sizeChip(q.size),
      onClear: () => setQuery({ size: undefined }),
    });
  if (q.source_type)
    chips.push({
      key: 'source_type',
      // Not in `/api/options/` (C-14) — the raw value, never a hardcoded map.
      label: `Source type: ${label(choices(options, 'catalog.source_type'), q.source_type)}`,
      onClear: () => setQuery({ source_type: undefined }),
    });
  if (q.created_after)
    chips.push({
      key: 'created_after',
      label: addedSinceChip(q.created_after),
      onClear: () => setQuery({ created_after: undefined }),
    });

  return (
    <DeskPage
      wide
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
          <MoreFilters q={q} setQuery={setQuery} facets={facets} />
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
            year: undefined,
            source: undefined,
            published: undefined,
            has_images: undefined,
            duplicate_images: undefined,
            gallery_portal: undefined,
            complete: undefined,
            size: undefined,
            source_type: undefined,
            created_after: undefined,
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

      {refused && (
        <PublishRefusal
          items={refused.items}
          onCancel={() => setRefused(null)}
          onComplete={() => {
            const id = refused.id;
            setRefused(null);
            navigate(`/admin/artworks/${id}`);
          }}
        />
      )}

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

/**
 * The old desk's "More filters" disclosure (`darz-studio.html:26676`) — the
 * secondary filters folded away so the toolbar's first line stays the three
 * that get used constantly.
 *
 * Every old filter the API serves is here: Year · Source · Market App (G-2),
 * then the four Phase 5b ones in the old order — Gallery Portal (`:26678`),
 * the Images select with its "Duplicates (same image)" pick (`:26682`),
 * Details (`:26683`) and Size (`:26685`). What each select does NOT offer of
 * the old one is in `artworkQuery.ts` and the page header.
 *
 * It stays open while any of its filters is active, and while the user left
 * it open (`:26676`'s own rules), so a narrowed list never hides why it is
 * narrow.
 */
function MoreFilters({
  q,
  setQuery,
  facets,
}: {
  q: ArtworkAdminQuery;
  setQuery: (patch: Partial<ArtworkAdminQuery>) => void;
  facets: ArtworkFacets;
}) {
  const active =
    q.year !== undefined ||
    q.source !== undefined ||
    q.published !== undefined ||
    q.has_images !== undefined ||
    q.duplicate_images !== undefined ||
    q.gallery_portal !== undefined ||
    q.complete !== undefined ||
    q.size !== undefined;

  // The old v582 rule (`:26676`): the user's own open intent persists across
  // the re-render a pick triggers (`_dbMoreOpen`), and an active filter forces
  // it open. Without the first half, clearing the last active select closed
  // the panel under the pointer.
  const [userOpen, setUserOpen] = useState(active);

  return (
    <details
      className="ad-morefilters"
      open={active || userOpen}
      onToggle={(e) => setUserOpen(e.currentTarget.open)}
    >
      <summary>More filters</summary>
      <div className="ad-morefilters-body">
        <SelectFilter
          label="Year"
          anyLabel="All Years"
          value={typeof q.year === 'string' ? q.year : undefined}
          onChange={(year) => setQuery({ year })}
          choices={facets.years.map((y) => ({ value: String(y), label: String(y) }))}
        />
        <SelectFilter
          label="Source"
          anyLabel="All Sources"
          value={q.source}
          onChange={(source) => setQuery({ source })}
          choices={facets.sources.map((sName) => ({ value: sName, label: sName }))}
        />
        <SelectFilter
          label="Market App"
          anyLabel="Market App: all"
          value={boolPick(q.published)}
          onChange={(v) => setQuery({ published: boolFrom(v) })}
          choices={[
            { value: 'true', label: 'In the app' },
            { value: 'false', label: 'Not in the app' },
          ]}
        />
        <SelectFilter
          label="Gallery Portal"
          anyLabel="Gallery Portal: all"
          value={boolPick(q.gallery_portal)}
          onChange={(v) => setQuery({ gallery_portal: boolFrom(v) })}
          choices={PORTAL_CHOICES}
        />
        <SelectFilter
          label="Images"
          anyLabel="All artworks"
          value={imagesPick(q)}
          onChange={(v) => setQuery(imagesPatch(v))}
          choices={IMAGES_CHOICES}
        />
        <SelectFilter
          label="Details"
          anyLabel="All details"
          value={boolPick(q.complete)}
          onChange={(v) => setQuery({ complete: boolFrom(v) })}
          choices={DETAILS_CHOICES}
        />
        <SelectFilter
          label="Size"
          anyLabel="All sizes"
          value={q.size}
          onChange={(v) => setQuery({ size: v as ArtworkAdminQuery['size'] })}
          choices={SIZE_CHOICES}
        />
      </div>
    </details>
  );
}

function label(list: Choice[], value: string): string {
  return list.find((c) => c.value === value)?.label ?? value;
}
