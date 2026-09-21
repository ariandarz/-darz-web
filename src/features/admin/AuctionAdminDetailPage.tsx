/**
 * AuctionAdminDetailPage — `/admin/auctions/:id`: one sale's record, its
 * Phase-35 privacy, and its lots.
 *
 * The API's own shape, stated where it bites:
 *  - an auction has NO edit endpoint (GET/DELETE only, G-AUC-1) — the
 *    record card says so instead of offering dead inputs;
 *  - lots are create-only (G-AUC-2) and move through **Go live**
 *    (scheduled→live; the artwork transitions to Reserved server-side) and
 *    **Close** — the engine sells only with bids AND the reserve met,
 *    otherwise the lot passes (force never overrides that); before the
 *    scheduled end a close must be *forced* ("Lot has not reached its end
 *    time yet."), so the desk offers **Close early** until then;
 *  - the reserve is confidential (the model: "never exposed to collectors;
 *    only reserve_met is public") — this desk shows it, because this desk
 *    is the one place that may.
 *
 * Invite-only (Phase 35, the old Club's "Make an auction private…"): the
 * switch plus the invited-collector picker; an uninvited collector never
 * sees the sale and cannot register a paddle — the model's own rule, on
 * the card copy.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { Auction, Choice, LotAdmin } from '../../api/types';
import { AuctionPill } from './AuctionsAdminPage';
import {
  ConfirmDialog,
  DeskBanner,
  DeskPage,
  Picker,
  type Column,
  type PickItem,
  DataTable,
} from './kit';
import './admin.css';

export function AuctionAdminDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { auctionsAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();

  const statuses = choices(options, 'auctions.auction_status');
  const [auction, setAuction] = useState<Auction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    auctionsAdmin.auction(id).then(
      (a) => setAuction(a),
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the auction.'),
    );
  }, [auctionsAdmin, id]);

  if (!auction) {
    return (
      <DeskPage wide title="Auction">
        {error ? <DeskBanner>{error}</DeskBanner> : <p className="dz-state">Loading…</p>}
      </DeskPage>
    );
  }

  return (
    <DeskPage
      wide
      title={auction.title}
      action={<AuctionPill status={auction.status} label={label(statuses, auction.status)} />}
    >
      <p className="ad-desksub">
        <button
          type="button"
          className="ad-ghostbtn"
          onClick={() => navigate('/admin/auctions')}
        >
          ← All auctions
        </button>
      </p>

      {error && <DeskBanner>{error}</DeskBanner>}

      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">Record</h2>
          <span className="ad-dsec-n">
            an auction has no edit endpoint yet (G-AUC-1) — the window and copy are fixed at
            creation
          </span>
        </div>
        <div className="ad-card ad-logins">
          <Row
            k="Window"
            v={`${new Date(auction.starts_at).toLocaleString('en-GB')} → ${new Date(auction.ends_at).toLocaleString('en-GB')}`}
          />
          <Row k="Currency" v={auction.currency} />
          <Row k="Lots" v={String(auction.lots_count ?? '—')} />
          {auction.description && <Row k="About" v={auction.description} />}
        </div>
      </section>

      <InviteCard auctionId={auction.id} />
      <LotsSection auction={auction} />
    </DeskPage>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="ad-recrow">
      <span className="ad-reck">{k}</span>
      <span className="ad-recv">{v}</span>
    </div>
  );
}

/** Phase 35 — the Club's "Make an auction private…". */
function InviteCard({ auctionId }: { auctionId: string }) {
  const { auctionsAdmin, adminAccounts } = useApi();
  const [inviteOnly, setInviteOnly] = useState(false);
  const [invited, setInvited] = useState<PickItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    auctionsAdmin.inviteList(auctionId).then(
      (data) => {
        if (!alive) return;
        setInviteOnly(data.invite_only);
        setInvited(data.invited_collectors.map((c) => ({ id: c.id, label: c.display_name })));
        setLoaded(true);
      },
      (err: unknown) =>
        alive &&
        setError(err instanceof Error ? err.message : 'Could not load the invite list.'),
    );
    return () => {
      alive = false;
    };
  }, [auctionsAdmin, auctionId]);

  const save = async (nextOnly: boolean, nextInvited: PickItem[]) => {
    setBusy(true);
    setError(null);
    try {
      const data = await auctionsAdmin.setInviteOnly(
        auctionId,
        nextOnly,
        nextInvited.map((p) => p.id),
      );
      setInviteOnly(data.invite_only);
      setInvited(data.invited_collectors.map((c) => ({ id: c.id, label: c.display_name })));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the invite list.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Privacy</h2>
        <span className="ad-dsec-n">
          private means an uninvited collector never sees this sale and cannot register a
          paddle
        </span>
      </div>
      {error && <DeskBanner>{error}</DeskBanner>}
      {!loaded ? (
        <p className="dz-state">Loading…</p>
      ) : (
        <div className="ad-card ad-reach">
          <label className="ad-actck">
            <input
              type="checkbox"
              checked={inviteOnly}
              disabled={busy}
              onChange={(e) => void save(e.target.checked, invited)}
            />
            Make this auction private — invited collectors only
          </label>
          {inviteOnly && (
            <Picker
              label="Invited collectors"
              placeholder="Search collectors — name, email, phone…"
              picked={invited}
              onChange={(items) => void save(true, items)}
              search={async (q) => {
                const page = await adminAccounts.collectors({ search: q, per_page: 8 });
                return page.results.map((c) => ({ id: c.id, label: c.display_name }));
              }}
            />
          )}
        </div>
      )}
    </section>
  );
}

function LotsSection({ auction }: { auction: Auction }) {
  const { auctionsAdmin, catalogAdmin } = useApi();
  const [lots, setLots] = useState<LotAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [closing, setClosing] = useState<{ lot: LotAdmin; force: boolean } | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());

  const load = useCallback(() => {
    auctionsAdmin.lots(auction.id, { per_page: 100 }).then(
      (page) => setLots(page.results),
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the lots.'),
    );
  }, [auctionsAdmin, auction.id]);
  useEffect(load, [load]);

  // resolve artwork titles (the admin lot row carries a bare uuid)
  useEffect(() => {
    if (!lots) return;
    let alive = true;
    const missing = [...new Set(lots.map((l) => l.artwork))].filter((aid) => !names.has(aid));
    if (missing.length === 0) return;
    void Promise.allSettled(
      missing.map(async (aid) => {
        const a = await catalogAdmin.artwork(aid);
        return [
          aid,
          a.artist_name_raw ? `${a.artist_name_raw} — ${a.title}` : a.title,
        ] as const;
      }),
    ).then((settled) => {
      if (!alive) return;
      setNames((prev) => {
        const next = new Map(prev);
        for (const r of settled)
          if (r.status === 'fulfilled') next.set(r.value[0], r.value[1]);
        return next;
      });
    });
    return () => {
      alive = false;
    };
  }, [lots, catalogAdmin, names]);

  const act = async (lotId: string, fn: () => Promise<LotAdmin>) => {
    setBusyId(lotId);
    setError(null);
    try {
      await fn();
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'That did not go through.');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Re-read ONE lot (`GET /auctions/admin/lots/{id}/`) and patch it in place.
   *
   * A live lot's bid count and current price move while an admin watches, and
   * until now the only way to see that was `load()` — every lot, plus the
   * artwork-name resolution that follows it, to learn one number. This is the
   * row asking about itself.
   *
   * It is deliberately NOT a detail screen: the endpoint answers the same
   * `LotAdminSerializer` the list does (`apps/auctions/views.py::admin_lot_detail`),
   * so there is nothing on a lot that this table does not already show, and a
   * page built to display it would be a screen invented to justify a route.
   */
  const refreshLot = async (lotId: string) => {
    setBusyId(lotId);
    setError(null);
    try {
      const fresh = await auctionsAdmin.lot(lotId);
      setLots((prev) => prev?.map((l) => (l.id === fresh.id ? fresh : l)) ?? prev);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not re-read the lot.');
    } finally {
      setBusyId(null);
    }
  };

  const columns: ReadonlyArray<Column<LotAdmin>> = [
    { key: 'n', header: 'Lot', cell: (l) => <b>{l.lot_number}</b> },
    {
      key: 'work',
      header: 'Artwork',
      cell: (l) => names.get(l.artwork) ?? '…',
    },
    {
      key: 'money',
      header: 'Opening · Reserve',
      cell: (l) => (
        <>
          <span className="ad-cellmain">
            {Number(l.opening_amount).toLocaleString('en-US')} {l.currency}
          </span>
          <span className="ad-cellsub">
            {/* confidential — this desk is the one place that may show it */}
            reserve {l.reserve_amount ? Number(l.reserve_amount).toLocaleString('en-US') : '—'}
            {l.reserve_met ? ' · met' : ''}
          </span>
        </>
      ),
    },
    {
      key: 'live',
      header: 'Bidding',
      cell: (l) =>
        l.bid_count ? (
          <>
            <span className="ad-cellmain">
              {Number(l.current_amount).toLocaleString('en-US')} {l.currency}
            </span>
            <span className="ad-cellsub">
              {l.bid_count} bid{l.bid_count === 1 ? '' : 's'}
            </span>
          </>
        ) : (
          <span className="ad-cellsub">no bids</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (l) => (
        <span
          className={`ad-stpill is-${l.status === 'live' ? 'ok' : l.status === 'sold' ? 'res' : l.status === 'scheduled' ? 'neut' : 'gone'}`}
        >
          {l.status}
        </span>
      ),
    },
    {
      key: 'acts',
      header: '',
      cell: (l) => (
        <span className="ad-rowacts">
          {l.status === 'scheduled' && (
            <button
              type="button"
              className="ad-rowbtn"
              disabled={busyId === l.id}
              onClick={() => void act(l.id, () => auctionsAdmin.goLive(l.id))}
            >
              Go live
            </button>
          )}
          {l.status === 'live' && (
            <button
              type="button"
              className="ad-rowbtn"
              disabled={busyId === l.id}
              title="Re-read this lot — a live lot's bids move while you watch"
              onClick={() => void refreshLot(l.id)}
            >
              Refresh
            </button>
          )}
          {l.status === 'live' &&
            (new Date(l.ends_at).getTime() > Date.now() ? (
              <button
                type="button"
                className="ad-rowbtn is-danger"
                disabled={busyId === l.id}
                title="Close before the scheduled end"
                onClick={() => setClosing({ lot: l, force: true })}
              >
                Close early
              </button>
            ) : (
              <button
                type="button"
                className="ad-rowbtn"
                disabled={busyId === l.id}
                onClick={() => setClosing({ lot: l, force: false })}
              >
                Close
              </button>
            ))}
        </span>
      ),
    },
  ];

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Lots</h2>
        <span className="ad-dsec-n">
          create-only (G-AUC-2); Go live reserves the artwork; a close before the scheduled end
          must be forced — the engine still only sells with bids and the reserve met
        </span>
      </div>
      {error && <DeskBanner>{error}</DeskBanner>}

      <p>
        <button type="button" className="ad-ghostbtn" onClick={() => setAdding(true)}>
          ＋ Add a lot
        </button>
      </p>

      {adding && (
        <NewLotForm
          auction={auction}
          nextNumber={(lots?.length ?? 0) + 1}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}

      {!lots && !error && <p className="dz-state">Loading…</p>}
      {lots &&
        (lots.length ? (
          <DataTable label="Lots" rows={lots} columns={columns} rowKey={(l) => l.id} />
        ) : (
          <p className="dz-state">No lots yet — add the first.</p>
        ))}

      {closing && (
        <ConfirmDialog
          message={
            closing.force
              ? `Close lot ${closing.lot.lot_number} EARLY — before its scheduled end? The engine sells to the leading bidder only if the reserve is met; otherwise the lot passes and the artwork returns to Available.`
              : `Close lot ${closing.lot.lot_number}? The engine sells to the leading bidder if the reserve is met — otherwise the lot passes and the artwork returns to Available.`
          }
          okLabel={closing.force ? 'Close early' : 'Close'}
          danger={closing.force}
          onCancel={() => setClosing(null)}
          onConfirm={() => {
            const c = closing;
            setClosing(null);
            void act(c.lot.id, () => auctionsAdmin.closeLot(c.lot.id, c.force));
          }}
        />
      )}
    </section>
  );
}

function NewLotForm({
  auction,
  nextNumber,
  onClose,
  onSaved,
}: {
  auction: Auction;
  nextNumber: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { auctionsAdmin, catalogAdmin } = useApi();
  const [work, setWork] = useState<PickItem[]>([]);
  const [lotNumber, setLotNumber] = useState(String(nextNumber));
  const [opening, setOpening] = useState('');
  const [reserve, setReserve] = useState('');
  const [low, setLow] = useState('');
  const [high, setHigh] = useState('');
  const [premium, setPremium] = useState('0');
  const [startsAt, setStartsAt] = useState(auction.starts_at.slice(0, 16));
  const [endsAt, setEndsAt] = useState(auction.ends_at.slice(0, 16));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    if (work.length === 0 || !opening.trim() || !lotNumber.trim()) {
      setError('An artwork, a lot number and an opening amount are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await auctionsAdmin.createLot({
        auction: auction.id,
        artwork: work[0].id,
        lot_number: Number(lotNumber),
        opening_amount: opening.trim(),
        reserve_amount: reserve.trim() || null,
        low_estimate: low.trim() || null,
        high_estimate: high.trim() || null,
        premium_pct: premium.trim() || '0',
        currency: auction.currency,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
      });
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create the lot.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-card ad-form">
      <div className="ad-form-h">Add a lot · {auction.currency}</div>
      <Picker
        label="Artwork"
        placeholder="Search the catalogue — artist, title, medium…"
        picked={work}
        onChange={setWork}
        single
        search={async (q) => {
          const page = await catalogAdmin.artworks({ search: q, per_page: 8 });
          return page.results.map((a) => ({
            id: a.id,
            label: a.artist_name_raw ? `${a.artist_name_raw} — ${a.title}` : a.title,
          }));
        }}
      />
      <div className="ad-form-grid">
        <label className="ad-field">
          <span className="ad-filter-l">Lot number</span>
          <input
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Opening amount</span>
          <input
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Reserve · confidential</span>
          <input
            value={reserve}
            onChange={(e) => setReserve(e.target.value)}
            inputMode="decimal"
            placeholder="never shown to collectors"
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Buyer's premium %</span>
          <input
            value={premium}
            onChange={(e) => setPremium(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Low estimate</span>
          <input value={low} onChange={(e) => setLow(e.target.value)} inputMode="decimal" />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">High estimate</span>
          <input value={high} onChange={(e) => setHigh(e.target.value)} inputMode="decimal" />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Bidding starts</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Bidding ends</span>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <p className="dz-state err" role="alert">
          {error}
        </p>
      )}
      <div className="ad-form-a">
        <button type="button" className="ad-ghostbtn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="ad-action"
          onClick={() => void save()}
          disabled={busy}
        >
          Add the lot
        </button>
      </div>
    </div>
  );
}

function choices(options: OptionsMap | null, key: string): Choice[] {
  return (options?.[key] as Choice[] | undefined) ?? [];
}

function label(list: Choice[], value: string): string {
  return list.find((c) => c.value === value)?.label ?? value;
}
