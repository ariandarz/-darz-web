/**
 * SalesPage — `/admin/sales`, the two Sales tabs over the backend's `Sale`
 * ledger (`DZSales.render()`, `darz-studio.html:12515`; the tabs at `:11750`):
 * **Market Sales** (`/admin/sales`) and **Auction Sales**
 * (`/admin/sales?source=auction`, the Galleries `?type=gallery` shape — one
 * route, two nav tabs, the query picks the tab). The old desk switched the same
 * renderer on `SALES.src` (`marketSalesView` / `auctionSalesView`, `:12511-12512`).
 *
 * Ported content:
 *  - the title per tab (`:12568`) and the sub-line's fact, adapted to this
 *    model: one deal, followed to the ledger, "N total." (`:12568`); here a
 *    market sale begins at the confirmed purchase intent (or by hand) and an
 *    auction sale when a lot closes won (the auction→Sale automation) — not at
 *    every request/registration/bid as the old derived store did, so the old
 *    "Every request, offer and hold" / "Every registration, bid and winning
 *    bid" clauses are adapted, not quoted;
 *  - the stats strip (`:12570-12575`). Five tiles where the old had four:
 *      · **Open deals** — same tile, same arithmetic (`:12541`).
 *      · **Need attention** — restored (G-SALE-5). The old count was
 *        `salesFlag` `attn`/`block` (`:12361`): follow-up due, stalled ≥10
 *        days, or payment overdue. Only the first has a field here
 *        (`follow_up_overdue`), so the tile counts **overdue follow-ups** —
 *        narrower than the old tile, stated rather than approximated.
 *      · **Payment pending** — the old label verbatim.
 *      · **Completed** and **Lost** — this model's, in the slot of the old
 *        "Sent to Accounting", which has no stage here (a `Sale` and a ledger
 *        entry are separate records with no "sent" flag between them). Lost is
 *        the old desk's `rejected` bucket (`:12546`).
 *    On Market Sales the four status tiles and the total read `summary/`
 *    (G-SALE-1); Auction Sales counts its own rows (see
 *    `SalesController.readStrip`). The summary is ledger-wide, so Market
 *    Sales is the whole ledger with a Source filter, where the old Market tab
 *    held market deals only;
 *  - the filter bar (`:12576-12581`): the search box (its old placeholder cut
 *    to what the server searches — artwork title, collector name, seller
 *    source; not artist or deal no.), the stage select ("All stages"), the
 *    payment select ("All payments") and the sort select, cut to the four
 *    orders the server has ("Recent first", "Oldest", "Highest value",
 *    "Lowest value"; the old follow-up/attention/payment/completed/accounting
 *    sorts have no `ordering` key). **Two selects are additions, flagged:**
 *    Delivery (the old desk filtered on `fDeliv`, `:12523`, but rendered no
 *    control for it) and Source (Market Sales only — the old source axis was
 *    the tab pair itself). Their "All …" wording follows the other two;
 *  - the "＋ New deal" action (`:12569`) and the row's price-first anatomy
 *    (`:12586-12600`): artwork · collector · the follow-up line under the
 *    collector (`.dzs-fu`, "Follow-up <date> · due", `:12590`) · status pill
 *    · payment/delivery · agreed price · "Next: <the chain's forward step>";
 *  - Auction Sales adds a **Lot** column linking to the lot's auction page.
 *    The old auction row was the market row (`_row` serves both); its deals
 *    carried `lotId` (`:12327`) but printed none. The link is the plan's
 *    acceptance ("an auction sale links to its lot"), flagged as an addition.
 *
 * Not ported: the List / Pipeline / Cards switch (`:12569`) — only List is
 * built; the per-deal thread and message templates, which live on the
 * Requests desk's thread here.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApi, useOptions, useSession } from '../../api/hooks';
import type { SaleAdmin, SaleQuery, TeamUserAdmin } from '../../api/types';
import { useListController } from '../shared/useListController';
import { asAdminRole } from './adminNav';
import {
  choices,
  label,
  SALE_SORT_DEFAULT,
  SALE_SORTS,
  saleNextStep,
  salesTab,
  saleTone,
  type SalesTab,
} from './saleForm';
import { SalesController, type SalesStrip } from './SalesController';
import { useSaleRefs } from './useSaleRefs';
import {
  DeskAction,
  DeskList,
  DeskPage,
  Picker,
  SearchFilter,
  SelectFilter,
  type Column,
  type PickItem,
} from './kit';
import './admin.css';

export function SalesPage() {
  const [params] = useSearchParams();
  const tab = salesTab(params.get('source'));
  // Keyed on the tab: both tabs are one route, so without the key React keeps
  // the Market controller (and its filters) when the nav switches tabs.
  return <SalesDesk key={tab} tab={tab} />;
}

function SalesDesk({ tab }: { tab: SalesTab }) {
  const { salesAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();
  const auction = tab === 'auction';

  // One controller for the list and the strip, so both read the same scope.
  const [controller] = useState(
    () => new SalesController(salesAdmin, {}, auction ? { source: 'auction' } : {}),
  );
  const { state, setQuery, setPage, reload } = useListController<SaleAdmin, SaleQuery>(
    () => controller,
  );
  const refs = useSaleRefs(state.results);

  const statuses = choices(options, 'sales.status');
  const payments = choices(options, 'sales.payment_status');
  const deliveries = choices(options, 'sales.delivery_status');
  // C-14: no `sales.source` in /api/options/ yet — labels fall back to the raw
  // value, and the VALUES come from the summary's own `by_source` keys.
  const sourceLabels = choices(options, 'sales.source');

  // The strip is the ledger's (or the Auction tab's), not the filters' — so it
  // is read on open and after a new deal, not on every filter change.
  const [strip, setStrip] = useState<SalesStrip | null>(null);
  const [stripTick, setStripTick] = useState(0);
  useEffect(() => {
    let alive = true;
    controller.readStrip().then(
      (s) => alive && setStrip(s),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [controller, stripTick]);

  const [creating, setCreating] = useState(false);

  const q = state.query;
  const filtered = !!(
    q.search ||
    q.status ||
    q.payment_status ||
    q.delivery_status ||
    q.source
  );

  const columns: Column<SaleAdmin>[] = [
    {
      key: 'work',
      header: 'Artwork',
      cell: (s) => {
        const a = refs.artwork(s.artwork);
        return (
          <>
            <span className="ad-cellmain">{a ? a.title : '…'}</span>
            {a?.artist && <span className="ad-cellsub">{a.artist}</span>}
          </>
        );
      },
    },
    {
      key: 'collector',
      header: 'Collector',
      cell: (s) => (
        <>
          {refs.collector(s.collector)}
          {s.follow_up_at && (
            <span className={`ad-salefu${s.follow_up_overdue ? ' is-over' : ''}`}>
              Follow-up {s.follow_up_at}
              {s.follow_up_overdue ? ' · due' : ''}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (s) => <SalePill status={s.status} label={label(statuses, s.status)} />,
    },
    {
      key: 'money',
      header: 'Agreed',
      cell: (s) => (
        <>
          <span className="ad-cellmain">
            {Number(s.agreed_price).toLocaleString('en-US')} {s.currency}
          </span>
          <span className="ad-cellsub">
            {label(payments, s.payment_status)} · {label(deliveries, s.delivery_status)}
          </span>
        </>
      ),
    },
    {
      key: 'next',
      header: 'Next',
      cell: (s) => {
        const next = saleNextStep(s.status);
        return next ? <b>{label(statuses, next)}</b> : <span className="ad-cellsub">—</span>;
      },
    },
    {
      key: 'when',
      header: 'Opened',
      className: 'ad-when',
      cell: (s) => new Date(s.created_at).toLocaleDateString('en-GB'),
    },
    {
      key: 'open',
      header: '',
      cell: (s) => (
        <button
          type="button"
          className="ad-rowbtn"
          onClick={() => navigate(`/admin/sales/${s.id}`)}
        >
          Open
        </button>
      ),
    },
  ];
  if (auction) {
    // The auction sale's link back to its lot (a lot lives on its auction's
    // page — there is no lot route). See the header on why it is an addition.
    columns.splice(2, 0, {
      key: 'lot',
      header: 'Lot',
      cell: (s) => {
        if (!s.lot) return <span className="ad-cellsub">—</span>;
        const lot = refs.lot(s.lot);
        return lot ? (
          <button
            type="button"
            className="ad-rowbtn"
            onClick={() => navigate(`/admin/auctions/${lot.auction}`)}
          >
            Lot {lot.number}
          </button>
        ) : (
          <span className="ad-cellsub">…</span>
        );
      },
    });
  }

  const total = strip ? ` ${strip.total} total.` : '';

  return (
    <DeskPage
      wide
      title={auction ? 'Auction Sales' : 'Market Sales'}
      action={<DeskAction onClick={() => setCreating(true)}>＋ New deal</DeskAction>}
      toolbar={
        <>
          <SearchFilter
            label="Search"
            value={q.search}
            placeholder="Search collector, artwork…"
            onChange={(search) => setQuery({ search })}
          />
          <SelectFilter
            label="Stage"
            anyLabel="All stages"
            value={q.status}
            onChange={(status) => setQuery({ status })}
            choices={statuses}
          />
          <SelectFilter
            label="Payment"
            anyLabel="All payments"
            value={q.payment_status}
            onChange={(payment_status) => setQuery({ payment_status })}
            choices={payments}
          />
          <SelectFilter
            label="Delivery"
            anyLabel="All deliveries"
            value={q.delivery_status}
            onChange={(delivery_status) => setQuery({ delivery_status })}
            choices={deliveries}
          />
          {!auction && (
            <SelectFilter
              label="Source"
              anyLabel="All sources"
              value={q.source}
              onChange={(source) => setQuery({ source })}
              choices={(strip?.sources ?? []).map((v) => ({
                value: v,
                label: label(sourceLabels, v),
              }))}
            />
          )}
          <SelectFilter
            label="Sort"
            anyLabel={SALE_SORT_DEFAULT}
            value={q.ordering}
            onChange={(ordering) => setQuery({ ordering })}
            choices={SALE_SORTS}
          />
        </>
      }
      subtitle={
        auction ? (
          <>
            Every winning bid — one deal, followed to the ledger. A lot that closes won opens
            its draft sale here — or add one by hand with ＋ New deal.{total}
          </>
        ) : (
          <>
            One deal, followed to the ledger. A sale begins at a confirmed purchase intent — or
            by hand with ＋ New deal; the funnel before that lives in Requests &amp; Activity.
            {total}
          </>
        )
      }
      strip={
        <div className="ad-tiles ad-tiles-sales">
          <Stat label="Open deals" value={strip?.tiles.open} />
          <Stat label="Need attention" value={strip?.attention} tone="attn" />
          <Stat label="Payment pending" value={strip?.tiles.payPending} tone="attn" />
          <Stat label="Completed" value={strip?.tiles.completed} tone="ok" />
          <Stat label="Lost" value={strip?.tiles.lost} />
        </div>
      }
    >
      {creating && (
        <NewDealForm
          source={auction ? 'auction' : undefined}
          onClose={() => setCreating(false)}
          onSaved={(sale) => {
            setCreating(false);
            void reload();
            setStripTick((t) => t + 1);
            navigate(`/admin/sales/${sale.id}`);
          }}
        />
      )}

      <DeskList
        label={auction ? 'Auction sales' : 'Sales'}
        status={state.status}
        error={state.error}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(s) => s.id}
        empty={
          // `:12562` — "No <src> deals match these filters." verbatim; the
          // no-deals-yet half adapted to what fills each tab here.
          filtered
            ? `No ${tab} deals match these filters.`
            : auction
              ? 'No auction deals yet. A lot that closes won appears here automatically — or add one with ＋ New deal.'
              : 'No deals yet — new confirmed purchase intents appear here, or add one with ＋ New deal.'
        }
      />
    </DeskPage>
  );
}

/** The sale status pill — the artworks pill's tones, mapped by `saleTone`. */
export function SalePill({ status, label: text }: { status: string; label: string }) {
  return <span className={`ad-stpill is-${saleTone(status)}`}>{text || status}</span>;
}

function Stat({
  label: l,
  value,
  tone,
}: {
  label: string;
  value: number | null | undefined;
  tone?: 'ok' | 'attn';
}) {
  return (
    <div className={`ad-tile${tone ? ` is-${tone}` : ''}`}>
      <span className="ad-tile-v">{value == null ? '…' : value}</span>
      <span className="ad-tile-l">{l}</span>
    </div>
  );
}

/** ＋ New deal (`:12571`) — artwork and collector by search picker, the
 * commercial snapshot, and `responsible`: the owner picks a team member (the
 * roster endpoint is owner-only); a standard admin records the deal under
 * their own login. */
function NewDealForm({
  source,
  onClose,
  onSaved,
}: {
  /** Opened from Auction Sales: the deal is recorded as `source: auction`. */
  source?: 'auction';
  onClose: () => void;
  onSaved: (sale: SaleAdmin) => void;
}) {
  const { salesAdmin, catalogAdmin, adminAccounts } = useApi();
  const { me } = useSession();
  const options = useOptions();
  const currencies = choices(options, 'currency');
  const isOwner = asAdminRole(me?.role) === 'owner';

  const [work, setWork] = useState<PickItem[]>([]);
  const [who, setWho] = useState<PickItem[]>([]);
  const [team, setTeam] = useState<TeamUserAdmin[]>([]);
  const [responsible, setResponsible] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('');
  const [commission, setCommission] = useState('');
  const [discount, setDiscount] = useState('');
  const [fees, setFees] = useState('');
  const [sellerSource, setSellerSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOwner) return;
    let alive = true;
    adminAccounts.teamUsers().then(
      (page) => alive && setTeam(page.results),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [isOwner, adminAccounts]);

  const save = async () => {
    if (busy) return;
    if (work.length === 0 || who.length === 0) {
      setError('A deal needs an artwork and a collector.');
      return;
    }
    if (!price.trim() || !currency || !commission.trim()) {
      setError('Agreed price, currency and commission are all required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sale = await salesAdmin.createSale({
        artwork: work[0].id,
        collector: who[0].id,
        responsible: (isOwner && responsible) || me?.id || '',
        agreed_price: price.trim(),
        currency: currency as SaleAdmin['currency'],
        commission_amount: commission.trim(),
        discount_amount: discount.trim() || null,
        fees_tax: fees.trim() || null,
        seller_source: sellerSource.trim(),
        ...(source ? { source } : {}),
      });
      onSaved(sale);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create the deal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-card ad-form">
      <div className="ad-form-h">New deal</div>
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
      <Picker
        label="Collector"
        placeholder="Search collectors — name, email, phone…"
        picked={who}
        onChange={setWho}
        single
        search={async (q) => {
          const page = await adminAccounts.collectors({ search: q, per_page: 8 });
          return page.results.map((c) => ({ id: c.id, label: c.display_name }));
        }}
      />
      <div className="ad-form-grid">
        {isOwner && (
          <label className="ad-field">
            <span className="ad-filter-l">Responsible</span>
            <select value={responsible} onChange={(e) => setResponsible(e.target.value)}>
              <option value="">— you —</option>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name || t.email}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="ad-field">
          <span className="ad-filter-l">Agreed price</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Currency</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="">— Select currency —</option>
            {currencies.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Commission</span>
          <input
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Discount · optional</span>
          <input
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Fees / tax · optional</span>
          <input value={fees} onChange={(e) => setFees(e.target.value)} inputMode="decimal" />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Seller source · optional</span>
          <input
            value={sellerSource}
            onChange={(e) => setSellerSource(e.target.value)}
            placeholder="the gallery / consignor this work sells from"
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
          Create deal
        </button>
      </div>
    </div>
  );
}
