/**
 * AccountingDeals — the Private Deals half of `/admin/accounting`
 * (`?view=deals`; the old panel's Deals & Commissions, whose math the
 * backend already serves as `pdealCalc`/`pdealSummary`).
 *
 * The list keeps the CRM shape: status + payment + month filters (the
 * server's own), the per-currency summary strip under the same filters,
 * rows with the deal's own `calc` primary line (net · remaining — computed
 * server-side, never in the client), priority marks and the follow-up date.
 * The editor is its own page (`/admin/accounting/deals/new|:id`) — the deal
 * form is the old panel's widest.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type {
  Choice,
  DealQuery,
  DealsSummary,
  Paginated,
  PrivateDealAdmin,
} from '../../api/types';
import { ListController } from '../shared/ListController';
import { useListController } from '../shared/useListController';
import type { AccountingAdminService } from '../../api/services';
import { DeskList, SelectFilter, type Column } from './kit';
import './admin.css';

class DealsController extends ListController<PrivateDealAdmin, DealQuery> {
  private readonly accounting: AccountingAdminService;
  constructor(accounting: AccountingAdminService, initial: DealQuery = {}) {
    super(initial);
    this.accounting = accounting;
  }
  protected fetchPage(query: DealQuery): Promise<Paginated<PrivateDealAdmin>> {
    return this.accounting.deals(query);
  }
}

export function AccountingDeals() {
  const { accountingAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();

  const statuses = choices(options, 'accounting.deal_status');
  const payStatuses = choices(options, 'accounting.deal_pay_status');

  const { state, setQuery, setPage } = useListController<PrivateDealAdmin, DealQuery>(
    () => new DealsController(accountingAdmin),
  );

  const [summary, setSummary] = useState<DealsSummary | null>(null);
  const loadSummary = useCallback(() => {
    const { page: _p, per_page: _pp, ...filters } = state.query;
    accountingAdmin.dealsSummary(filters).then(
      (s) => setSummary(s),
      () => setSummary(null),
    );
  }, [accountingAdmin, state.query]);
  useEffect(loadSummary, [loadSummary]);

  const calcLine = (d: PrivateDealAdmin) => {
    const calc = d.calc as unknown as {
      primary?: string | null;
      by_currency?: Record<string, { net?: string; remaining?: string }>;
    } | null;
    const cur = calc?.primary;
    if (!cur || !calc?.by_currency?.[cur]) return null;
    const b = calc.by_currency[cur];
    return `net ${Number(b.net ?? 0).toLocaleString('en-US')} ${cur}${
      Number(b.remaining ?? 0) > 0
        ? ` · ${Number(b.remaining).toLocaleString('en-US')} remaining`
        : ''
    }`;
  };

  const columns: ReadonlyArray<Column<PrivateDealAdmin>> = [
    {
      key: 'deal',
      header: 'Deal',
      cell: (d) => (
        <>
          <span className="ad-cellmain">
            {d.priority === 'urgent' ? '⚑ ' : d.priority === 'high' ? '△ ' : ''}
            {d.title || d.artwork_label || 'Untitled deal'}
          </span>
          <span className="ad-cellsub">
            {[d.artist_label, d.artwork_label].filter(Boolean).join(' — ') || '—'}
          </span>
        </>
      ),
    },
    {
      key: 'parties',
      header: 'Buyer ← Seller',
      cell: (d) => (
        <>
          <span className="ad-cellmain">{d.buyer_name || '—'}</span>
          <span className="ad-cellsub">{d.seller_name || '—'}</span>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Stage',
      cell: (d) => (
        <span
          className={`ad-stpill is-${
            d.status === 'paid'
              ? 'ok'
              : d.status === 'cancelled'
                ? 'gone'
                : d.status === 'archived'
                  ? 'neut'
                  : 'res'
          }`}
        >
          {label(statuses, d.status ?? '')}
        </span>
      ),
    },
    {
      key: 'pay',
      header: 'Payment',
      cell: (d) => label(payStatuses, d.pay_status ?? '') || '—',
    },
    {
      key: 'calc',
      header: 'The math',
      cell: (d) => calcLine(d) ?? <span className="ad-cellsub">no amounts yet</span>,
    },
    {
      key: 'follow',
      header: 'Follow-up',
      className: 'ad-when',
      cell: (d) =>
        d.followup_date ? new Date(d.followup_date).toLocaleDateString('en-GB') : '—',
    },
    {
      key: 'open',
      header: '',
      cell: (d) => (
        <button
          type="button"
          className="ad-rowbtn"
          onClick={() => navigate(`/admin/accounting/deals/${d.id}`)}
        >
          Open
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="ad-toolbar">
        <SelectFilter
          label="Stage"
          anyLabel="All stages"
          value={state.query.status}
          onChange={(status) => setQuery({ status })}
          choices={statuses}
        />
        <SelectFilter
          label="Payment"
          anyLabel="All payments"
          value={state.query.pay_status}
          onChange={(pay_status) => setQuery({ pay_status })}
          choices={payStatuses}
        />
        <label className="ad-filter">
          <span className="ad-filter-l">Month</span>
          <input
            type="month"
            value={state.query.month ?? ''}
            onChange={(e) => setQuery({ month: e.target.value || undefined })}
          />
        </label>
      </div>

      {summary && summary.currencies.length > 0 && (
        <div className="ad-tiles ad-tiles-sales">
          {summary.currencies.map((cur) => {
            const b = summary.by_currency[cur];
            return (
              <div key={cur} className="ad-tile">
                <span className="ad-tile-v">
                  {Number(b.net).toLocaleString('en-US')} {cur}
                </span>
                <span className="ad-tile-l">
                  net · {Number(b.sale).toLocaleString('en-US')} sale ·{' '}
                  {Number(b.received).toLocaleString('en-US')} received
                  {Number(b.remaining) > 0
                    ? ` · ${Number(b.remaining).toLocaleString('en-US')} remaining`
                    : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <DeskList
        label="Private deals"
        status={state.status}
        error={state.error}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(d) => d.id}
        empty="No private deals yet — open the first with ＋ New deal."
      />
    </>
  );
}

function choices(options: OptionsMap | null, key: string): Choice[] {
  return (options?.[key] as Choice[] | undefined) ?? [];
}

function label(list: Choice[], value: string): string {
  return list.find((c) => c.value === value)?.label ?? value;
}
