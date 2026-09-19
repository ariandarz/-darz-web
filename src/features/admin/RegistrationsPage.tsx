/**
 * RegistrationsPage — `/admin/auction-registrations`, "Register to Bid"
 * (`auctionsRegView()`, `darz-studio.html:31780ish` — the paddle queue).
 *
 * Ported content:
 *  - the columns: Collector · Auction · Request date · Status · actions;
 *  - the status filter (Pending/Approved/Rejected — the server's own);
 *  - the action titles, verbatim: "Approve — the collector is told they
 *    are registered" / "Reject this registration request — the collector
 *    is notified". Approving assigns the auction's NEXT SEQUENTIAL PADDLE
 *    NUMBER server-side — the row shows it once assigned (the old app's
 *    anonymous paddle promise, "e.g. Bidder 482913", now a real column).
 *
 * Not ported: the old ↺ Reset (clears a request so the collector may
 * re-request) — no such endpoint (G-AUC-3); a rejected collector's path
 * back is a new registration from the app once the backend allows it.
 * Rows carry bare uuids — resolved against the rosters, the sales desk's
 * pattern.
 */
import { useEffect, useState } from 'react';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { Auction, BidderRegistrationAdmin, Choice } from '../../api/types';
import { DeskBanner, DeskList, DeskPage, SelectFilter, type Column } from './kit';
import { ListController } from '../shared/ListController';
import { useListController } from '../shared/useListController';
import type { AuctionsAdminService } from '../../api/services';
import type { Paginated } from '../../api/types';
import './admin.css';

interface RegQuery {
  auction?: string;
  status?: string;
  page?: number;
  per_page?: number;
}

class RegistrationsController extends ListController<BidderRegistrationAdmin, RegQuery> {
  private readonly auctions: AuctionsAdminService;
  constructor(auctions: AuctionsAdminService, initial: RegQuery = {}) {
    super(initial);
    this.auctions = auctions;
  }
  protected fetchPage(query: RegQuery): Promise<Paginated<BidderRegistrationAdmin>> {
    return this.auctions.registrations(query);
  }
}

export function RegistrationsPage() {
  const { auctionsAdmin, adminAccounts } = useApi();
  const options = useOptions();
  const statuses = choices(options, 'auctions.registration_status');

  const { state, setQuery, setPage, reload } = useListController<
    BidderRegistrationAdmin,
    RegQuery
  >(() => new RegistrationsController(auctionsAdmin, { status: 'pending' }));

  const [auctions, setAuctions] = useState<Auction[]>([]);
  useEffect(() => {
    let alive = true;
    auctionsAdmin.auctions({ per_page: 100 }).then(
      (page) => alive && setAuctions(page.results),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [auctionsAdmin]);
  const auctionTitle = (aid: string) => auctions.find((a) => a.id === aid)?.title ?? '…';

  const [collectors, setCollectors] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let alive = true;
    const missing = [...new Set(state.results.map((r) => r.collector))].filter(
      (cid) => !collectors.has(cid),
    );
    if (missing.length === 0) return;
    void Promise.allSettled(
      missing.map(
        async (cid) => [cid, (await adminAccounts.collector(cid)).display_name] as const,
      ),
    ).then((settled) => {
      if (!alive) return;
      setCollectors((prev) => {
        const next = new Map(prev);
        for (const r of settled)
          if (r.status === 'fulfilled') next.set(r.value[0], r.value[1]);
        return next;
      });
    });
    return () => {
      alive = false;
    };
  }, [state.results, adminAccounts, collectors]);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const act = async (reg: BidderRegistrationAdmin, verdict: 'approve' | 'reject') => {
    setBusyId(reg.id);
    setActionError(null);
    try {
      if (verdict === 'approve') await auctionsAdmin.approveRegistration(reg.id);
      else await auctionsAdmin.rejectRegistration(reg.id);
      await reload();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Could not record the decision.');
    } finally {
      setBusyId(null);
    }
  };

  const columns: ReadonlyArray<Column<BidderRegistrationAdmin>> = [
    {
      key: 'collector',
      header: 'Collector',
      cell: (r) => collectors.get(r.collector) ?? '…',
    },
    { key: 'auction', header: 'Auction', cell: (r) => auctionTitle(r.auction) },
    {
      key: 'when',
      header: 'Request date',
      className: 'ad-when',
      cell: (r) => new Date(r.created_at).toLocaleString('en-GB'),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <span
          className={`ad-stpill is-${r.status === 'approved' ? 'ok' : r.status === 'rejected' ? 'gone' : 'res'}`}
        >
          {label(statuses, r.status)}
        </span>
      ),
    },
    {
      key: 'paddle',
      header: 'Paddle',
      cell: (r) => (r.paddle_number != null ? <b>#{r.paddle_number}</b> : '—'),
    },
    {
      key: 'acts',
      header: '',
      cell: (r) =>
        r.status === 'pending' ? (
          <span className="ad-rowacts">
            <button
              type="button"
              className="ad-rowbtn"
              disabled={busyId === r.id}
              title="Approve — the collector is told they are registered"
              onClick={() => void act(r, 'approve')}
            >
              ✓ Approve
            </button>
            <button
              type="button"
              className="ad-rowbtn is-danger"
              disabled={busyId === r.id}
              title="Reject this registration request — the collector is notified"
              onClick={() => void act(r, 'reject')}
            >
              Reject
            </button>
          </span>
        ) : null,
    },
  ];

  return (
    <DeskPage
      title="Register to Bid"
      toolbar={
        <>
          <SelectFilter
            label="Status"
            anyLabel="All statuses"
            value={state.query.status}
            onChange={(status) => setQuery({ status })}
            choices={statuses}
          />
          <SelectFilter
            label="Auction"
            anyLabel="All auctions"
            value={state.query.auction}
            onChange={(auction) => setQuery({ auction })}
            choices={auctions.map((a) => ({ value: a.id, label: a.title }))}
          />
        </>
      }
    >
      <p className="ad-desksub">
        Paddle requests from the app. Approving assigns the auction's next sequential paddle
        number — the anonymous paddle the collector bids under.
      </p>
      {actionError && <DeskBanner>{actionError}</DeskBanner>}
      <DeskList
        label="Registrations"
        status={state.status}
        error={state.error}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(r) => r.id}
        empty={
          state.query.status === 'pending'
            ? 'Nothing waiting — every paddle request is answered.'
            : 'No registrations here.'
        }
      />
    </DeskPage>
  );
}

function choices(options: OptionsMap | null, key: string): Choice[] {
  return (options?.[key] as Choice[] | undefined) ?? [];
}

function label(list: Choice[], value: string): string {
  return list.find((c) => c.value === value)?.label ?? value;
}
