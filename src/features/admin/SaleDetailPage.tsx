/**
 * SaleDetailPage — `/admin/sales/:id`, the old expanded deal row
 * (`DZSales._detail`, `darz-studio.html:12608`) as a page.
 *
 * Ported content:
 *  - the stage rail as actions: the current status pill plus only the LEGAL
 *    next moves (the ported `SALE_TRANSITIONS` chain; the old free stage
 *    <select> could claim any stage — this backend's machine cannot);
 *  - the meta block (`:12615`): deal id · source request · collector ·
 *    currency;
 *  - the money fields (`:12627`, the v1129 Discount Manager's facts): agreed
 *    price · discount · fees/tax · commission — **editable in draft only**,
 *    the R7 lock, said on the card once locked;
 *  - Payment / Delivery setters (`:12633-12634`) on their real endpoints.
 *
 * The old follow-up reminders, notes, templates and the per-deal thread have
 * no home on `Sale` (G-SALE-5) — the conversation lives on the collector's
 * request thread.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { Choice, SaleAdmin } from '../../api/types';
import { SalePill } from './SalesPage';
import { saleTermsLocked, saleTransitionTargets } from './saleForm';
import { useSaleRefs } from './useSaleRefs';
import { DeskBanner, DeskPage } from './kit';
import './admin.css';

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { salesAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();

  const [sale, setSale] = useState<SaleAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refs = useSaleRefs(sale ? [sale] : []);

  const statuses = choices(options, 'sales.status');
  const payments = choices(options, 'sales.payment_status');
  const deliveries = choices(options, 'sales.delivery_status');

  const load = useCallback(() => {
    if (!id) return;
    salesAdmin.sale(id).then(
      (s) => setSale(s),
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the deal.'),
    );
  }, [salesAdmin, id]);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<SaleAdmin>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setSale(await fn());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'That did not go through.');
    } finally {
      setBusy(false);
    }
  };

  if (!sale) {
    return (
      <DeskPage title="Deal">
        {error ? <DeskBanner>{error}</DeskBanner> : <p className="dz-state">Loading…</p>}
      </DeskPage>
    );
  }

  const art = refs.artwork(sale.artwork);
  const locked = saleTermsLocked(sale);

  return (
    <DeskPage
      title={art ? `${art.artist ? `${art.artist} — ` : ''}${art.title}` : 'Deal'}
      action={<SalePill status={sale.status} label={label(statuses, sale.status)} />}
    >
      <p className="ad-desksub">
        <button type="button" className="ad-ghostbtn" onClick={() => navigate('/admin/sales')}>
          ← All deals
        </button>
      </p>

      {error && <DeskBanner>{error}</DeskBanner>}

      {/* ---- stage & the two setters ---- */}
      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">Stage</h2>
          <span className="ad-dsec-n">
            the chain is guarded — only the legal moves are offered
          </span>
        </div>
        <div className="ad-card ad-reach">
          <div className="ad-reachrow">
            <SalePill status={sale.status} label={label(statuses, sale.status)} />
            {saleTransitionTargets(sale.status).map((to) => (
              <button
                key={to}
                type="button"
                className={`ad-rowbtn${to === 'lost' ? ' is-danger' : ''}`}
                disabled={busy}
                onClick={() => void act(() => salesAdmin.transitionSale(sale.id, to))}
              >
                → {label(statuses, to)}
              </button>
            ))}
            {saleTransitionTargets(sale.status).length === 0 && (
              <span className="ad-cellsub">a terminal stage — no further moves</span>
            )}
          </div>
          <div className="ad-reachrow">
            <label className="ad-field">
              <span className="ad-filter-l">Payment</span>
              <select
                value={sale.payment_status}
                disabled={busy}
                onChange={(e) =>
                  void act(() => salesAdmin.setPaymentStatus(sale.id, e.target.value))
                }
              >
                {payments.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="ad-field">
              <span className="ad-filter-l">Delivery</span>
              <select
                value={sale.delivery_status}
                disabled={busy}
                onChange={(e) =>
                  void act(() => salesAdmin.setDeliveryStatus(sale.id, e.target.value))
                }
              >
                {deliveries.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {/* ---- the meta block (:12615) ---- */}
      <section className="ad-dsec">
        <div className="ad-dsec-h">
          <h2 className="ad-dsec-t">Deal</h2>
        </div>
        <div className="ad-card ad-logins">
          <Row k="Deal ID" v={sale.id} />
          <Row
            k="Artwork"
            v={art ? `${art.artist ? `${art.artist} — ` : ''}${art.title}` : '…'}
          >
            <button
              type="button"
              className="ad-rowbtn"
              onClick={() => navigate(`/admin/artworks/${sale.artwork}`)}
            >
              Open
            </button>
          </Row>
          <Row k="Collector" v={refs.collector(sale.collector) ?? '…'}>
            <button
              type="button"
              className="ad-rowbtn"
              onClick={() => navigate(`/admin/collectors/${sale.collector}`)}
            >
              Open
            </button>
          </Row>
          <Row k="Responsible" v={refs.responsible(sale.responsible) ?? '—'} />
          {sale.source_request && <Row k="From request" v={sale.source_request} />}
          <Row k="Seller source" v={sale.seller_source || '—'} />
          <Row
            k="Confirmed"
            v={
              sale.confirmed_at
                ? new Date(sale.confirmed_at).toLocaleString('en-GB')
                : 'not yet'
            }
          />
          <Row k="Opened" v={new Date(sale.created_at).toLocaleString('en-GB')} />
        </div>
      </section>

      {/* ---- the commercial snapshot (draft-only, R7) ---- */}
      <TermsCard sale={sale} locked={locked} onSaved={setSale} />
    </DeskPage>
  );
}

function Row({ k, v, children }: { k: string; v: string; children?: React.ReactNode }) {
  return (
    <div className="ad-recrow">
      <span className="ad-reck">{k}</span>
      <span className="ad-recv">{v}</span>
      {children}
    </div>
  );
}

function TermsCard({
  sale,
  locked,
  onSaved,
}: {
  sale: SaleAdmin;
  locked: boolean;
  onSaved: (s: SaleAdmin) => void;
}) {
  const { salesAdmin } = useApi();
  const [price, setPrice] = useState(sale.agreed_price);
  const [commission, setCommission] = useState(sale.commission_amount);
  const [discount, setDiscount] = useState(sale.discount_amount ?? '');
  const [fees, setFees] = useState(sale.fees_tax ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(
        await salesAdmin.updateSale(sale.id, {
          agreed_price: price.trim(),
          commission_amount: commission.trim(),
          discount_amount: discount.trim() || null,
          fees_tax: fees.trim() || null,
          expected_version: sale.version,
        }),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the terms.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Commercial terms</h2>
        <span className="ad-dsec-n">
          {locked
            ? 'locked — the snapshot is fixed once a deal is confirmed (R7)'
            : 'editable while the deal is a draft; confirming locks the snapshot (R7)'}
        </span>
      </div>
      <div className="ad-card ad-form">
        <div className="ad-form-grid">
          <label className="ad-field">
            <span className="ad-filter-l">Agreed price · {sale.currency}</span>
            <input
              value={price}
              disabled={locked || busy}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">Commission</span>
            <input
              value={commission}
              disabled={locked || busy}
              onChange={(e) => setCommission(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">Discount</span>
            <input
              value={discount}
              disabled={locked || busy}
              onChange={(e) => setDiscount(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="ad-field">
            <span className="ad-filter-l">Fees / tax</span>
            <input
              value={fees}
              disabled={locked || busy}
              onChange={(e) => setFees(e.target.value)}
              inputMode="decimal"
            />
          </label>
        </div>
        {error && (
          <p className="dz-state err" role="alert">
            {error}
          </p>
        )}
        {!locked && (
          <div className="ad-form-a">
            <button
              type="button"
              className="ad-action"
              disabled={busy}
              onClick={() => void save()}
            >
              Save terms
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function choices(options: OptionsMap | null, key: string): Choice[] {
  return (options?.[key] as Choice[] | undefined) ?? [];
}

function label(list: Choice[], value: string): string {
  return list.find((c) => c.value === value)?.label ?? value;
}
