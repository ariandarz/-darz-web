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
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
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
  type Column,
} from './kit';
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
          <SelectFilter
            label="Status"
            anyLabel="All statuses"
            value={state.query.status}
            onChange={(status) => setQuery({ status })}
            choices={statuses}
          />
        </>
      }
    >
      <p className="ad-desksub">
        Third-party auction-house results — the market's memory, kept as comparables. What
        collectors browse under Records; ★ marks the highlights strip.
      </p>
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
