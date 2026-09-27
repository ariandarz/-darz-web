/**
 * RecordsAdminPage — `/admin/auction-records`, the Auction Records desk
 * (`recordsView()`, `darz-studio.html:20225`) over the widened external
 * results DB (backend Phase 11-admin, BE-R1…R6 — the Phase 8 gap list
 * closed).
 *
 * Ported content:
 *  - the Past / Upcoming / Live sections (`?section=` — BE-R6, the old
 *    tab's own sub-tabs) plus search and the admin-only status filter;
 *  - the row anatomy: artist · lot title, year · house/sale · date ·
 *    realized-beats-price money line · status pill · the highlight star;
 *  - Edit / Remove; ＋ New record opens the full editor.
 *
 * Not ported: the old tab's four import methods and the darz.art archive
 * browser — migration machinery for the old cloud, dead architecture here
 * (the Import desk's CSV path covers bulk entry when needed).
 *
 * **Compared against `10-auction-records`, 2026-09-22.** The old chip row is
 * `All · Upcoming · Past · Highlights · Artist`, then four selects, then a
 * List / Cards toggle and a `✦ n / 10` counter. Where each one landed:
 *  - **Upcoming / Past** — the Section select, already ported (BE-R6).
 *  - **Highlights** — was missing, and is **now built** (the toggle below):
 *    `is_highlight` was already in the query type and nothing exposed it, so
 *    the desk drew the ★ per row with no way to ask for the strip.
 *  - **All results** — the Status select, already ported; the old filter's
 *    options are this model's `auctions.record_status`.
 *  - **Artist** — the old chip opens one artist's records. Here that is the
 *    `artist` query param, reached by the Artists desk's record-count link,
 *    which is itself deferred with the counts (G-CAT-3). Not a second
 *    control on this desk.
 *  - **All auction houses** — **built in V1 Phase 3** over `?house=`
 *    (G-REC-1, an exact match). The old control was a searchable multi-select
 *    (`recHouseMS`, `:20303-20312`); the API takes one house, so it is a
 *    single select with the old "All auction houses" label. Its options are
 *    the old rule — the standard houses plus any house in the data
 *    (`recordHouses.ts`) — and the data half is read by walking the records
 *    list once, because the backend has no house facet endpoint (backend
 *    candidate: a distinct-houses facet).
 *  - **Sort** — not built, and not invented. The old options are
 *    `Most recent · Most records · Artist A–Z · Artist Z–A` (`:20324`) — a
 *    set for a desk that GROUPS BY ARTIST, which this one does not. The API
 *    orders by `sale_date` / `price_amount` / `created_at`, so a sort here
 *    would be four new options the old desk never offered.
 *  - **`✦ n / 10`** — the old highlights cap. No server-side cap exists
 *    (`is_highlight` is a plain boolean), so the counter would be asserting
 *    a rule nothing enforces.
 *  - **List / Cards** — table only, the same call as Collectors (**G-4**).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import { MAX_PER_PAGE, walkPages } from '../../api/paging';
import type { OptionsMap } from '../../api/services';
import type { AuctionRecord, AuctionRecordQuery, Choice, Paginated } from '../../api/types';
import { ListController } from '../shared/ListController';
import { useListController } from '../shared/useListController';
import type { AuctionsAdminService } from '../../api/services';
import {
  ConfirmDialog,
  DeskAction,
  DeskBanner,
  DeskList,
  DeskPage,
  SearchFilter,
  SelectFilter,
  ToggleFilter,
  type Column,
} from './kit';
import { houseOptions, REC_KNOWN_HOUSES } from './recordHouses';
import './admin.css';

class RecordsController extends ListController<AuctionRecord, AuctionRecordQuery> {
  private readonly auctions: AuctionsAdminService;
  constructor(auctions: AuctionsAdminService, initial: AuctionRecordQuery = {}) {
    super(initial);
    this.auctions = auctions;
  }
  protected fetchPage(query: AuctionRecordQuery): Promise<Paginated<AuctionRecord>> {
    return this.auctions.records(query);
  }
}

const SECTIONS: Choice[] = [
  { value: 'past', label: 'Past' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'live', label: 'Live' },
];

export function RecordsAdminPage() {
  const { auctionsAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();
  const statuses = choices(options, 'auctions.record_status');

  const { state, setQuery, setPage, reload } = useListController<
    AuctionRecord,
    AuctionRecordQuery
  >(() => new RecordsController(auctionsAdmin));

  // The house list: standard houses at once, the stored ones once the walk
  // lands (no facet endpoint — see the header).
  const [houses, setHouses] = useState<string[]>(() => houseOptions([]));
  useEffect(() => {
    let alive = true;
    walkPages((page) => auctionsAdmin.records({ page, per_page: MAX_PER_PAGE })).then(
      (all) =>
        alive &&
        setHouses(
          houseOptions(
            all.map((r) => r.house),
            REC_KNOWN_HOUSES,
          ),
        ),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [auctionsAdmin]);

  const [removing, setRemoving] = useState<AuctionRecord | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const remove = async (r: AuctionRecord) => {
    setActionError(null);
    try {
      await auctionsAdmin.deleteRecord(r.id);
      await reload();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Could not remove the record.');
    }
  };

  const money = (r: AuctionRecord) => {
    const v = r.realized_amount ?? r.hammer_amount ?? r.price_amount;
    if (!v) return '—';
    const kind = r.realized_amount ? 'realized' : r.hammer_amount ? 'hammer' : '';
    return `${Number(v).toLocaleString('en-US')} ${r.currency ?? ''}${kind ? ` · ${kind}` : ''}`;
  };

  const columns: ReadonlyArray<Column<AuctionRecord>> = [
    {
      key: 'work',
      header: 'Lot',
      cell: (r) => (
        <>
          <span className="ad-cellmain">
            {r.is_highlight ? '★ ' : ''}
            {r.artist_display_name || '—'}
          </span>
          <span className="ad-cellsub">
            {r.lot_title}
            {r.year ? `, ${r.year}` : ''}
          </span>
        </>
      ),
    },
    {
      key: 'sale',
      header: 'Sale',
      cell: (r) => (
        <>
          <span className="ad-cellmain">{r.house}</span>
          {r.sale_name && <span className="ad-cellsub">{r.sale_name}</span>}
        </>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      className: 'ad-when',
      cell: (r) => (r.sale_date ? new Date(r.sale_date).toLocaleDateString('en-GB') : '—'),
    },
    { key: 'money', header: 'Result', cell: money },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <span
          className={`ad-stpill is-${r.status === 'sold' ? 'ok' : r.status === 'pending' ? 'res' : 'neut'}`}
        >
          {label(statuses, r.status ?? '')}
        </span>
      ),
    },
    {
      key: 'acts',
      header: '',
      cell: (r) => (
        <span className="ad-rowacts">
          <button
            type="button"
            className="ad-rowbtn"
            onClick={() => navigate(`/admin/auction-records/${r.id}`)}
          >
            Edit
          </button>
          <button type="button" className="ad-rowbtn is-danger" onClick={() => setRemoving(r)}>
            Remove
          </button>
        </span>
      ),
    },
  ];

  return (
    <DeskPage
      wide
      title="Auction Records"
      action={
        <DeskAction onClick={() => navigate('/admin/auction-records/new')}>
          ＋ New record
        </DeskAction>
      }
      toolbar={
        <>
          <SearchFilter
            label="Search"
            value={state.query.search}
            onChange={(search) => setQuery({ search })}
            placeholder="Search records — artist, house, lot title…"
          />
          <SelectFilter
            label="Section"
            anyLabel="All sections"
            value={state.query.section}
            onChange={(section) => setQuery({ section })}
            choices={SECTIONS}
          />
          {/* the old "All auction houses" (`:20305`) — `?house=` (G-REC-1) */}
          <SelectFilter
            label="House"
            anyLabel="All auction houses"
            value={state.query.house}
            onChange={(house) => setQuery({ house })}
            choices={houses.map((h) => ({ value: h, label: h }))}
          />
          <SelectFilter
            label="Status"
            anyLabel="All statuses"
            value={state.query.status}
            onChange={(status) => setQuery({ status })}
            choices={statuses}
          />
          {/* The old chip row's ★ Highlights (`:20318`). The desk has always
              SHOWN the star per row and had no way to filter by it, while
              `is_highlight` sat in `AuctionRecordQuery` unused — found
              2026-09-22 against `10-auction-records`. The server spells the
              boolean `True`/`False`, the same as the other admin filters. */}
          <ToggleFilter
            label="★ Highlights"
            checked={state.query.is_highlight === 'True'}
            onChange={(on) => setQuery({ is_highlight: on ? 'True' : undefined })}
          />
        </>
      }
      subtitle={
        <>
          Third-party auction-house results — the market's memory, kept as comparables. What
          collectors browse under Records; ★ marks the highlights strip.
        </>
      }
    >
      {actionError && <DeskBanner>{actionError}</DeskBanner>}
      <DeskList
        label="Auction records"
        status={state.status}
        error={state.error}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(r) => r.id}
        empty="No records match — add the first result."
      />
      {removing && (
        <ConfirmDialog
          message={`Remove the record for “${removing.lot_title}”? It leaves the collector Records browse too.`}
          okLabel="Remove"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const r = removing;
            setRemoving(null);
            void remove(r);
          }}
        />
      )}
    </DeskPage>
  );
}

function choices(options: OptionsMap | null, key: string): Choice[] {
  return (options?.[key] as Choice[] | undefined) ?? [];
}

function label(list: Choice[], value: string): string {
  return list.find((c) => c.value === value)?.label ?? value;
}
