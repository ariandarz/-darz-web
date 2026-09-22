/**
 * SalesPage — `/admin/sales`, Market Sales (`DZSales.render()` with
 * `src='market'`, `darz-studio.html:12517`; the tab at `:11740`) over the
 * backend's `Sale` ledger.
 *
 * Ported content:
 *  - the title and the sub-line's fact, adapted to this model: one deal,
 *    followed to the ledger (`:12570` — "Every request, offer and hold — one
 *    deal, followed to the ledger"); here a Sale begins at the confirmed
 *    purchase intent (or by hand) rather than absorbing every request — the
 *    Requests desk holds the funnel's front;
 *  - the stats strip (`:12573`). **Two of its four tiles are this model's,
 *    not the old panel's** — recorded here 2026-09-22 after the fidelity pass
 *    compared the desk against `15-market-sales` and found the line above had
 *    been misquoting the source. The old four are
 *    `Open deals · Need attention · Payment pending · Sent to Accounting`
 *    (`:12541-12544`), and they map across like this:
 *      · **Open deals** — same tile, same arithmetic (`stage` is neither
 *        `accounting` nor `rejected`; here, neither `completed` nor `lost`).
 *      · **Payment pending** — same tile, and the label is now the old one
 *        verbatim; it had drifted to "Awaiting payment".
 *      · **Need attention** — NOT ported. `attn` is `salesFlag(d)` returning
 *        `attn`/`block`, computed client-side over the old deal store's
 *        follow-up dates and notes (G-SALE-5) — fields the `Sale` model does
 *        not carry, so there is nothing to count. **Completed** takes the
 *        slot: a terminal status this ledger does have.
 *      · **Sent to Accounting** — NOT ported, because there is no such stage
 *        here. The old panel hands a finished deal to its Accounting desk as
 *        a workflow step; in this backend a `Sale` and a ledger entry are
 *        separate records with no "sent" flag between them (the Accounting
 *        desk reads the ledger directly). **Lost** takes the slot — the old
 *        desk's own `rejected`/lost bucket, which it offered as a stage
 *        filter (`:12546`) but never as a tile.
 *    All four counts are read per status from the server's own pagination
 *    totals (no aggregate endpoint, G-SALE-1);
 *  - the "＋ New deal" action (`:12571`) and the row's price-first anatomy
 *    (`:12594`): artwork · collector · status pill · payment/delivery ·
 *    agreed price · "Next: <the chain's forward step>" (`:12599`);
 *  - the status filter. The old stage/payment filters, the text search and
 *    the sort menu (`:12548-12551`) have no server params (G-SALE-2) and the
 *    pipeline/cards views wait with them — stated, not dropped.
 *
 * The old desk's follow-up reminders, notes, templates and thread live in
 * the old client-local deal store; the Sale model does not carry them
 * (G-SALE-5) — the Requests desk's thread is where the conversation lives.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useOptions, useSession } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { Choice, SaleAdmin, SaleQuery, TeamUserAdmin } from '../../api/types';
import { useListController } from '../shared/useListController';
import { asAdminRole } from './adminNav';
import { saleNextStep, saleTone } from './saleForm';
import { SalesController } from './SalesController';
import { useSaleRefs } from './useSaleRefs';
import {
  DeskAction,
  DeskList,
  DeskPage,
  Picker,
  SelectFilter,
  type Column,
  type PickItem,
} from './kit';
import './admin.css';

export function SalesPage() {
  const { salesAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();

  const { state, setQuery, setPage, reload } = useListController<SaleAdmin, SaleQuery>(
    () => new SalesController(salesAdmin),
  );
  const refs = useSaleRefs(state.results);

  const statuses = choices(options, 'sales.status');
  const payments = choices(options, 'sales.payment_status');
  const deliveries = choices(options, 'sales.delivery_status');

  // the stats strip — per-status totals from the server's own pagination
  // (per_page=1 → total_count), the honest form of the old client-side
  // counts (:12545-12548) while no aggregate endpoint exists (G-SALE-1)
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let alive = true;
    const keys = ['draft', 'confirmed', 'invoiced', 'paid', 'delivered', 'completed', 'lost'];
    void Promise.allSettled(
      keys.map(
        async (k) =>
          [
            k,
            (await salesAdmin.sales({ status: k, per_page: 1 })).pagination.total_count,
          ] as const,
      ),
    ).then((settled) => {
      if (!alive) return;
      const out: Record<string, number> = {};
      for (const r of settled) if (r.status === 'fulfilled') out[r.value[0]] = r.value[1];
      setCounts(out);
    });
    return () => {
      alive = false;
    };
  }, [salesAdmin, state.results]);

  const open =
    counts &&
    ['draft', 'confirmed', 'invoiced', 'paid', 'delivered'].reduce(
      (n, k) => n + (counts[k] ?? 0),
      0,
    );
  const payPending = counts && (counts.confirmed ?? 0) + (counts.invoiced ?? 0);

  const [creating, setCreating] = useState(false);

  const columns: ReadonlyArray<Column<SaleAdmin>> = [
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
      cell: (s) => refs.collector(s.collector) ?? '…',
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

  return (
    <DeskPage
      wide
      title="Market Sales"
      action={<DeskAction onClick={() => setCreating(true)}>＋ New deal</DeskAction>}
      toolbar={
        <SelectFilter
          label="Status"
          anyLabel="All stages"
          value={state.query.status}
          onChange={(status) => setQuery({ status })}
          choices={statuses}
        />
      }
      subtitle={
        <>
          One deal, followed to the ledger. A sale begins at a confirmed purchase intent — or
          by hand with ＋ New deal; the funnel before that lives in Requests &amp; Activity.
          Search, the payment/stage filters and the Pipeline / Cards views wait on the API
          (G-SALE-2).
        </>
      }
    >
      <div className="ad-tiles ad-tiles-sales">
        <Stat label="Open deals" value={open} />
        <Stat label="Payment pending" value={payPending} tone="attn" />
        <Stat label="Completed" value={counts?.completed} tone="ok" />
        <Stat label="Lost" value={counts?.lost} />
      </div>

      {creating && (
        <NewDealForm
          onClose={() => setCreating(false)}
          onSaved={(sale) => {
            setCreating(false);
            void reload();
            navigate(`/admin/sales/${sale.id}`);
          }}
        />
      )}

      <DeskList
        label="Sales"
        status={state.status}
        error={state.error}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(s) => s.id}
        empty="No deals yet — new confirmed purchase intents appear here, or add one with ＋ New deal."
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
  onClose,
  onSaved,
}: {
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
        responsible: (isOwner && responsible) || me?.id || null,
        agreed_price: price.trim(),
        currency: currency as SaleAdmin['currency'],
        commission_amount: commission.trim(),
        discount_amount: discount.trim() || null,
        fees_tax: fees.trim() || null,
        seller_source: sellerSource.trim(),
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

function choices(options: OptionsMap | null, key: string): Choice[] {
  return (options?.[key] as Choice[] | undefined) ?? [];
}

function label(list: Choice[], value: string): string {
  return list.find((c) => c.value === value)?.label ?? value;
}
