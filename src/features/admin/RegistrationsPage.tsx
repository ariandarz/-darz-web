/**
 * RegistrationsPage — `/admin/auction-registrations`, "Register to Bid"
 * (`auctionsRegView()`, `darz-studio.html:31865` — the paddle queue).
 *
 * **This desk's reference is not what the old tab opens — recorded
 * 2026-09-22.** Comparing against `46-auction-registrations` showed the
 * capture is the REQUESTS desk in its Auctions scope, not a paddle queue,
 * which sent the comparison back to the nav: `:11745` routes the tab through
 * `DarzAdmin.goReg()` with `page:'activity'`, and `:38046` records why —
 * v1044 moved "Register to Bid" into the Activity desk's Auctions scope,
 * over `kind==='auction-register'` request rows (`aucRegRequests`, `:29371`).
 * `auctionsRegView()` is the view it replaced and is no longer reachable.
 *
 * So this desk is a **deliberate divergence, and the right one**: registration
 * is a first-class model in this backend (`BidderRegistration`, with a
 * server-assigned sequential paddle) rather than a request kind, so it gets a
 * desk that can show the paddle. What the old panel does in its place is
 * exactly what the Requests desk here does — those rows arrive there too, as
 * requests. Its dead predecessor's sub-line (`:31893`) carries a
 * "N pending · N approved" clause this desk could answer from the status
 * counts; it is left off rather than revived from a superseded view.
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
 *  - **↺ Reset** (V1 Phase 3, G-AUC-3) — the old button's label and title
 *    (`:31887`), its confirm (`:39857`) and toast (`:39860`, less the "—
 *    Collector <key>" suffix, which named the old access key). The old desk
 *    offered it on every row; the endpoint resets a REJECTED registration
 *    back to pending (anything else is a 400, C-11), so it shows on rejected
 *    rows only.
 *
 * Rows carry bare uuids — resolved against the rosters, the sales desk's
 * pattern. The auction titles come from a walk of every auction, archived
 * included (a registration outlives its sale being archived), not the first
 * 100.
 */
import { useEffect, useState } from 'react';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { Auction, BidderRegistrationAdmin, Choice } from '../../api/types';
import { MAX_PER_PAGE, walkPages } from '../../api/paging';
import {
  ConfirmDialog,
  DeskBanner,
  DeskList,
  DeskPage,
  DeskToast,
  SelectFilter,
  useDeskToast,
  type Column,
} from './kit';
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
    const walk = (archived?: boolean) =>
      walkPages((page) => auctionsAdmin.auctions({ page, per_page: MAX_PER_PAGE, archived }));
    Promise.all([walk(), walk(true)]).then(
      ([working, archived]) => alive && setAuctions([...working, ...archived]),
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

  const [resetting, setResetting] = useState<BidderRegistrationAdmin | null>(null);
  const { say, message } = useDeskToast();

  const act = async (
    reg: BidderRegistrationAdmin,
    verdict: 'approve' | 'reject' | 'reset',
  ) => {
    setBusyId(reg.id);
    setActionError(null);
    try {
      if (verdict === 'approve') await auctionsAdmin.approveRegistration(reg.id);
      else if (verdict === 'reject') await auctionsAdmin.rejectRegistration(reg.id);
      else {
        await auctionsAdmin.resetRegistration(reg.id);
        say('Registration reset');
      }
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
        ) : r.status === 'rejected' ? (
          <span className="ad-rowacts">
            <button
              type="button"
              className="ad-rowbtn"
              disabled={busyId === r.id}
              title="Reset — clears this request; the collector returns to “Register” and can request again"
              onClick={() => setResetting(r)}
            >
              ↺ Reset
            </button>
          </span>
        ) : null,
    },
  ];

  return (
    <DeskPage
      wide
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
      subtitle={
        <>
          Paddle requests from the app. Approving assigns the auction's next sequential paddle
          number — the anonymous paddle the collector bids under.
        </>
      }
    >
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
      {resetting && (
        /* `:39857`, verbatim */
        <ConfirmDialog
          message="Reset this registration? The collector will go back to “Register for the next auction” and can request again."
          okLabel="Reset"
          onCancel={() => setResetting(null)}
          onConfirm={() => {
            const r = resetting;
            setResetting(null);
            void act(r, 'reset');
          }}
        />
      )}
      <DeskToast message={message} />
    </DeskPage>
  );
}

function choices(options: OptionsMap | null, key: string): Choice[] {
  return (options?.[key] as Choice[] | undefined) ?? [];
}

function label(list: Choice[], value: string): string {
  return list.find((c) => c.value === value)?.label ?? value;
}
