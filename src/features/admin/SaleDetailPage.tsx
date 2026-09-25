/**
 * SaleDetailPage — `/admin/sales/:id`, the old expanded deal row / Deal Card
 * (`DZSales._detail`, `darz-studio.html:12599`) as a page.
 *
 * Ported content:
 *  - the stage rail as actions: the current status pill plus only the LEGAL
 *    next moves (the ported `SALE_TRANSITIONS` chain; the old free stage
 *    <select> could claim any stage — this backend's machine cannot);
 *  - the meta block (`:12604-12612`): deal id · source request · **source**
 *    (`<span>Source</span>`, `:12607`; the label falls back to the raw value,
 *    C-14) · collector · currency; plus the **lot** of an auction sale, linked
 *    to its auction's page (the old deal carried `lotId`, `:12327`, but the
 *    card printed none — an addition, flagged);
 *  - the money fields (`:12616-12621`, the v1129 Discount Manager's facts):
 *    agreed price · discount · fees/tax · commission — **editable in draft
 *    only**, the R7 lock, said on the card once locked;
 *  - Payment / Delivery setters (`:12622-12623`) on their real endpoints;
 *  - **Follow-up with the collector** (`:12625-12633`, G-SALE-5): the
 *    "Follow-up with collector: <date> — due" / "No follow-up set." line, the
 *    "Remind me in" 3 days · 1 week · 2 weeks presets (`setFollow`, `:12733`,
 *    with its "Follow-up set for <date>" toast), the date field and Clear. The
 *    "due" flag is the server's `follow_up_overdue`;
 *  - **Notes** (`:12634`, `:12653-12657`, G-SALE-5): newest first, each with
 *    its "YYYY-MM-DD HH:MM · <author>" stamp, "No notes yet.", the textarea
 *    with its old placeholder and "Add note" (`addNote`, `:12734`, toast "Note
 *    added"). Append-only — the old card had no note edit/delete either;
 *  - **Delete deal** (`:12664`) behind the old confirm's wording (`:12770`).
 *
 * Not ported: the per-deal message box and templates (the conversation lives
 * on the collector's request thread), the Documents section, and the
 * "Confirm deal completed → / Sent to Accounting" hand-off (no such stage).
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import { MAX_PER_PAGE, walkPages } from '../../api/paging';
import type { SaleAdmin, SaleNote } from '../../api/types';
import { SalePill } from './SalesPage';
import {
  choices,
  followUpIn,
  label,
  noteStamp,
  saleTermsLocked,
  saleTransitionTargets,
} from './saleForm';
import { useSaleRefs } from './useSaleRefs';
import {
  ConfirmDialog,
  ConflictBanner,
  DeskBanner,
  DeskPage,
  DeskSave,
  DeskToast,
  isConflict,
  useDeskToast,
} from './kit';
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
  const { say, message } = useDeskToast();

  const statuses = choices(options, 'sales.status');
  const payments = choices(options, 'sales.payment_status');
  const deliveries = choices(options, 'sales.delivery_status');
  const sources = choices(options, 'sales.source'); // C-14: absent → raw value
  const [deleting, setDeleting] = useState(false);

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
      say('Deal updated ✓');
    } catch (err: unknown) {
      // No conflict branch here, deliberately: the transition and the two
      // status setters send no `expected_version` and the API declares only
      // 400/404 on them (`apps/sales/views.py`). Only the terms PATCH below
      // can 409, so only it carries the banner (TD-5).
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
  const lot = refs.lot(sale.lot);
  const locked = saleTermsLocked(sale);
  // Back to the tab the deal belongs to (the old desk's `SALES.src`).
  const back = sale.source === 'auction' ? '/admin/sales?source=auction' : '/admin/sales';

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await salesAdmin.deleteSale(sale.id);
      navigate(back);
    } catch (err: unknown) {
      setDeleting(false);
      setError(err instanceof Error ? err.message : 'Could not delete the deal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DeskPage
      title={art ? `${art.artist ? `${art.artist} — ` : ''}${art.title}` : 'Deal'}
      action={<SalePill status={sale.status} label={label(statuses, sale.status)} />}
      subtitle={
        <>
          <button type="button" className="ad-ghostbtn" onClick={() => navigate(back)}>
            ← All deals
          </button>
        </>
      }
    >
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

      {/* ---- the meta block (:12604) ---- */}
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
              onClick={() => navigate(`/admin/artworks/${sale.artwork.id}`)}
            >
              Open
            </button>
          </Row>
          <Row k="Collector" v={refs.collector(sale.collector)}>
            <button
              type="button"
              className="ad-rowbtn"
              onClick={() => navigate(`/admin/collectors/${sale.collector.id}`)}
            >
              Open
            </button>
          </Row>
          <Row k="Source" v={label(sources, sale.source)} />
          {sale.lot && (
            <Row k="Lot" v={lot ? `Lot ${lot.number}` : '…'}>
              {lot && (
                <button
                  type="button"
                  className="ad-rowbtn"
                  onClick={() => navigate(`/admin/auctions/${lot.auction}`)}
                >
                  Open
                </button>
              )}
            </Row>
          )}
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
      <TermsCard sale={sale} locked={locked} onSaved={setSale} onReload={load} onSaid={say} />

      <FollowUpCard sale={sale} onSaved={setSale} onSaid={say} />
      <NotesCard saleId={sale.id} onSaid={say} />

      <div className="ad-form-a">
        <button
          type="button"
          className="ad-rowbtn is-danger"
          disabled={busy}
          onClick={() => setDeleting(true)}
        >
          Delete deal
        </button>
      </div>
      {deleting && (
        <ConfirmDialog
          message="Delete this deal? The collector’s request/activity is not affected."
          okLabel="Delete"
          danger
          busy={busy}
          onCancel={() => setDeleting(false)}
          onConfirm={() => void remove()}
        />
      )}
      <DeskToast message={message} />
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
  onReload,
  onSaid,
}: {
  sale: SaleAdmin;
  locked: boolean;
  onSaved: (s: SaleAdmin) => void;
  /** Re-read the deal after a 409 — the other person's version. */
  onReload: () => void;
  /** The desk's toast, so the card confirms in the same place everything else does. */
  onSaid: (message: string) => void;
}) {
  const { salesAdmin } = useApi();
  const [price, setPrice] = useState(sale.agreed_price);
  const [commission, setCommission] = useState(sale.commission_amount);
  const [discount, setDiscount] = useState(sale.discount_amount ?? '');
  const [fees, setFees] = useState(sale.fees_tax ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setConflict(false);
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
      onSaid('Terms saved ✓');
    } catch (err: unknown) {
      if (isConflict(err)) setConflict(true);
      else setError(err instanceof Error ? err.message : 'Could not save the terms.');
      // `DeskSave` only flashes when the write resolves.
      throw err;
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
        {conflict && (
          <ConflictBanner
            noun="deal"
            onReload={() => {
              setConflict(false);
              onReload();
            }}
          />
        )}
        {error && (
          <p className="dz-state err" role="alert">
            {error}
          </p>
        )}
        {!locked && (
          <div className="ad-form-a">
            <DeskSave
              className="ad-action"
              busy={busy}
              savedLabel="Terms saved"
              onClick={save}
            >
              Save terms
            </DeskSave>
          </div>
        )}
      </div>
    </section>
  );
}

/** Follow-up with the collector (`:12625-12633`). No lock, and editable after
 * confirm (operational, not a commercial term). A refusal is a 400 with the
 * server's message, shown on the card. */
function FollowUpCard({
  sale,
  onSaved,
  onSaid,
}: {
  sale: SaleAdmin;
  onSaved: (s: SaleAdmin) => void;
  onSaid: (message: string) => void;
}) {
  const { salesAdmin } = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** `said` only for the presets — the old date field and Clear wrote
   * silently (`setField`, `:12726`); `setFollow` toasted (`:12733`). */
  const set = async (date: string | null, said?: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await salesAdmin.followUp(sale.id, date));
      if (said) onSaid(said);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not set the follow-up.');
    } finally {
      setBusy(false);
    }
  };
  const preset = (days: number) => {
    const date = followUpIn(days);
    void set(date, `Follow-up set for ${date}`);
  };

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Follow-up with the collector</h2>
      </div>
      <div className="ad-card ad-reach">
        <p className="ad-salefubar">
          {sale.follow_up_at ? (
            <>
              Follow-up with collector: <b>{sale.follow_up_at}</b>
              {sale.follow_up_overdue ? ' — due' : ''}
            </>
          ) : (
            'No follow-up set.'
          )}
        </p>
        <div className="ad-reachrow">
          <span className="ad-cellsub">Remind me in</span>
          <button
            type="button"
            className="ad-rowbtn"
            disabled={busy}
            onClick={() => preset(3)}
          >
            3 days
          </button>
          <button
            type="button"
            className="ad-rowbtn"
            disabled={busy}
            onClick={() => preset(7)}
          >
            1 week
          </button>
          <button
            type="button"
            className="ad-rowbtn"
            disabled={busy}
            onClick={() => preset(14)}
          >
            2 weeks
          </button>
          <span className="ad-field">
            <input
              type="date"
              aria-label="Follow-up date"
              value={sale.follow_up_at ?? ''}
              disabled={busy}
              onChange={(e) => void set(e.target.value || null)}
            />
          </span>
          {sale.follow_up_at && (
            <button
              type="button"
              className="ad-rowbtn"
              disabled={busy}
              onClick={() => void set(null)}
            >
              Clear
            </button>
          )}
        </div>
        {error && (
          <p className="dz-state err" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

/** The deal's internal notes (`:12653-12657`). The whole thread is read (it is
 * paginated, newest first); a new note is put at the top from the POST's own
 * answer, so it appears without a reload. */
function NotesCard({ saleId, onSaid }: { saleId: string; onSaid: (message: string) => void }) {
  const { salesAdmin } = useApi();
  const [notes, setNotes] = useState<SaleNote[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    walkPages((page) => salesAdmin.notes(saleId, { page, per_page: MAX_PER_PAGE })).then(
      (rows) => alive && setNotes(rows),
      (err: unknown) =>
        alive &&
        setLoadError(err instanceof Error ? err.message : 'Could not load the notes.'),
    );
    return () => {
      alive = false;
    };
  }, [salesAdmin, saleId]);

  const add = async () => {
    const body = draft.trim();
    if (!body || busy) return; // the old `if(!t)return`
    setBusy(true);
    setError(null);
    try {
      const note = await salesAdmin.addNote(saleId, body);
      setNotes((prev) => [note, ...(prev ?? [])]);
      setDraft('');
      onSaid('Note added');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not add the note.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ad-dsec ad-salenotes">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Notes</h2>
      </div>
      <div className="ad-card ad-form">
        {loadError ? (
          <p className="dz-state err">{loadError}</p>
        ) : notes === null ? (
          <p className="dz-state">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="ad-cellsub">No notes yet.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="ad-salenote">
              <span className="ad-salenote-m">
                {noteStamp(n.created_at)} · {n.author_name || 'admin'}
              </span>
              {n.body}
            </div>
          ))
        )}
        <span className="ad-field">
          <textarea
            aria-label="Add a note"
            placeholder="Add a follow-up / negotiation / internal note…"
            value={draft}
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
          />
        </span>
        {error && (
          <p className="dz-state err" role="alert">
            {error}
          </p>
        )}
        <div className="ad-form-a">
          <button
            type="button"
            className="ad-ghostbtn"
            disabled={busy}
            onClick={() => void add()}
          >
            Add note
          </button>
        </div>
      </div>
    </section>
  );
}
