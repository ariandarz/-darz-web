/**
 * DealEditorPage — `/admin/accounting/deals/new|:id`, one private deal in
 * full (owner-only, like everything in accounting).
 *
 * The write serializer's whole surface, grouped the way the old card read:
 * the deal · the work · buyer · seller · commission & payment · the money
 * grid (each of the model's 15 amounts with its own currency — amounts are
 * never mixed across currencies, so each row carries both) · follow-up ·
 * the FX line. Every vocabulary comes from `GET /api/options/`
 * (`accounting.deal_*`), never hardcoded.
 *
 * The **calc card** renders the serializer's own per-currency roll-up —
 * `pdealCalc` served; the client never re-implements the math. Attachments
 * (edit only): slotted uploads with served URLs.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { Choice, PrivateDealAdmin } from '../../api/types';
import { ConfirmDialog, DeskBanner, DeskPage } from './kit';
import './admin.css';

const MONEY_FIELDS: ReadonlyArray<[string, string]> = [
  ['buyer_offer', "Buyer's offer"],
  ['sale_price', 'Sale price'],
  ['seller_asking', "Seller's asking"],
  ['commission_amount', 'Commission'],
  ['darz_share', 'Darz share'],
  ['partner_share', 'Partner share'],
  ['dealer_share', 'Dealer share'],
  ['total_expenses', 'Total expenses'],
  ['cost_framing', 'Framing'],
  ['cost_shipping', 'Shipping'],
  ['cost_insurance', 'Insurance'],
  ['cost_photography', 'Photography'],
  ['cost_restoration', 'Restoration'],
  ['cost_other', 'Other costs'],
  ['amount_received', 'Received so far'],
];

const CORE_TEXT_FIELDS = [
  'title',
  'deal_date',
  'note',
  'artist_label',
  'artwork_label',
  'year',
  'medium',
  'size',
  'edition',
  'cert_note',
  'buyer_name',
  'buyer_contact',
  'buyer_location',
  'pay_note',
  'seller_name',
  'seller_contact',
  'seller_note',
  'commission_pct',
  'due_date',
  'pay_track_note',
  'next_action',
  'followup_date',
  'reminder',
  'deal_currency',
  'deal_fx_rate',
  'deal_fx_target_currency',
  'deal_fx_rate_date',
] as const;

const CHOICE_FIELDS = [
  'status',
  'priority',
  'pay_status',
  'seller_pay_status',
  'source_type',
  'commission_type',
  'pay_method',
] as const;

type Draft = Record<string, string>;

export function DealEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const { accountingAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();

  const [deal, setDeal] = useState<PrivateDealAdmin | null>(null);
  const [draft, setDraft] = useState<Draft | null>(isNew ? emptyDraft() : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const adopt = useCallback((d: PrivateDealAdmin) => {
    setDeal(d);
    const next = emptyDraft();
    const raw = d as unknown as Record<string, unknown>;
    for (const k of Object.keys(next)) {
      const v = raw[k];
      next[k] = v == null ? '' : String(v);
    }
    setDraft(next);
  }, []);

  const load = useCallback(() => {
    if (isNew || !id) return;
    accountingAdmin
      .deal(id)
      .then(adopt, (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the deal.'),
      );
  }, [accountingAdmin, id, isNew, adopt]);
  useEffect(load, [load]);

  const set = (k: string, v: string) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const save = async () => {
    if (!draft || busy) return;
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {};
    const choiceLike = new Set<string>([
      ...CHOICE_FIELDS,
      'deal_currency',
      'deal_fx_target_currency',
      ...MONEY_FIELDS.map(([k]) => `${k}_currency`),
    ]);
    for (const [k, v] of Object.entries(draft)) {
      const t = v.trim();
      if (choiceLike.has(k)) {
        // an unset ChoiceField must be OMITTED — '' is not a member of the
        // vocabulary and would 400
        if (t) body[k] = t;
      } else if (k.endsWith('_date')) {
        body[k] = t || null;
      } else if (
        MONEY_FIELDS.some(([mk]) => mk === k) ||
        k === 'commission_pct' ||
        k === 'deal_fx_rate'
      ) {
        body[k] = t || null;
      } else {
        body[k] = t;
      }
    }
    try {
      if (isNew) {
        const created = await accountingAdmin.createDeal(body);
        navigate(`/admin/accounting/deals/${created.id}`, { replace: true });
      } else {
        adopt(await accountingAdmin.updateDeal(id!, body));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the deal.');
    } finally {
      setBusy(false);
    }
  };

  if (!draft) {
    return (
      <DeskPage title="Private deal">
        {error ? <DeskBanner>{error}</DeskBanner> : <p className="dz-state">Loading…</p>}
      </DeskPage>
    );
  }

  const f = (k: string, l: string, ph?: string, type?: string) => (
    <label className="ad-field" key={k}>
      <span className="ad-filter-l">{l}</span>
      <input
        type={type}
        value={draft[k] ?? ''}
        onChange={(e) => set(k, e.target.value)}
        placeholder={ph}
      />
    </label>
  );
  const sel = (k: string, l: string, opts: Choice[], any?: string) => (
    <label className="ad-field" key={k}>
      <span className="ad-filter-l">{l}</span>
      <select value={draft[k] ?? ''} onChange={(e) => set(k, e.target.value)}>
        {any !== undefined && <option value="">{any}</option>}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  const opt = (key: string) => choices(options, key);
  const currencies = opt('currency');

  return (
    <DeskPage title={isNew ? 'New private deal' : draft.title || 'Private deal'}>
      <p className="ad-desksub">
        <button
          type="button"
          className="ad-ghostbtn"
          onClick={() => navigate('/admin/accounting?view=deals')}
        >
          ← All deals
        </button>
      </p>
      {error && <DeskBanner>{error}</DeskBanner>}

      {deal && <CalcCard deal={deal} />}

      <div className="ad-card ad-form">
        <div className="ad-form-h">The deal</div>
        <div className="ad-form-grid">
          {f('title', 'Title')}
          {f('deal_date', 'Deal date', undefined, 'date')}
          {sel('status', 'Stage', opt('accounting.deal_status'))}
          {sel('priority', 'Priority', opt('accounting.deal_priority'))}
          {f('note', 'Note')}
        </div>

        <div className="ad-form-h">The work</div>
        <div className="ad-form-grid">
          {f('artist_label', 'Artist')}
          {f('artwork_label', 'Artwork')}
          {f('year', 'Year')}
          {f('medium', 'Medium')}
          {f('size', 'Size')}
          {f('edition', 'Edition')}
          {f('cert_note', 'Certificate note')}
        </div>

        <div className="ad-form-h">Buyer</div>
        <div className="ad-form-grid">
          {f('buyer_name', 'Name')}
          {f('buyer_contact', 'Contact')}
          {f('buyer_location', 'Location')}
          {sel('pay_status', 'Payment', opt('accounting.deal_pay_status'))}
          {f('pay_note', 'Payment note')}
        </div>

        <div className="ad-form-h">Seller</div>
        <div className="ad-form-grid">
          {f('seller_name', 'Name')}
          {f('seller_contact', 'Contact')}
          {sel('source_type', 'Source type', opt('accounting.deal_source_type'), '—')}
          {sel('seller_pay_status', 'Seller payout', opt('accounting.deal_seller_pay_status'))}
          {f('seller_note', 'Seller note')}
        </div>

        <div className="ad-form-h">Commission &amp; payment</div>
        <div className="ad-form-grid">
          {sel('commission_type', 'Commission type', opt('accounting.deal_commission_type'))}
          {f('commission_pct', 'Commission %')}
          {sel('pay_method', 'Method', opt('accounting.deal_pay_method'), '—')}
          {f('due_date', 'Due date', undefined, 'date')}
          {f('pay_track_note', 'Payment tracking note')}
        </div>

        <div className="ad-form-h">
          The money <span className="ad-subnote">— each amount keeps its own currency</span>
        </div>
        <div className="ad-moneygrid">
          {MONEY_FIELDS.map(([k, l]) => (
            <div key={k} className="ad-moneyrow">
              <span className="ad-filter-l">{l}</span>
              <input
                inputMode="decimal"
                value={draft[k] ?? ''}
                onChange={(e) => set(k, e.target.value)}
              />
              <select
                value={draft[`${k}_currency`] ?? ''}
                onChange={(e) => set(`${k}_currency`, e.target.value)}
              >
                <option value="">—</option>
                {currencies.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="ad-form-h">Follow-up</div>
        <div className="ad-form-grid">
          {f('next_action', 'Next action')}
          {f('followup_date', 'Follow-up date', undefined, 'date')}
          {f('reminder', 'Reminder')}
        </div>

        <div className="ad-form-h">Deal FX · optional</div>
        <div className="ad-form-grid">
          {sel('deal_currency', 'Deal currency', currencies, '—')}
          {sel('deal_fx_target_currency', 'Convert to', currencies, '—')}
          {f('deal_fx_rate', 'Rate')}
          {f('deal_fx_rate_date', 'Rate date', undefined, 'date')}
        </div>

        <div className="ad-form-a">
          <button
            type="button"
            className="ad-action"
            disabled={busy}
            onClick={() => void save()}
          >
            {isNew ? 'Open the deal' : 'Save deal'}
          </button>
        </div>
      </div>

      {!isNew && id && deal && <AttachmentsSection dealId={id} deal={deal} onChanged={load} />}
    </DeskPage>
  );
}

/** The serializer's own per-currency roll-up — never client math. */
function CalcCard({ deal }: { deal: PrivateDealAdmin }) {
  const calc = deal.calc as unknown as {
    currencies?: string[];
    by_currency?: Record<
      string,
      { sale?: string; received?: string; net?: string; remaining?: string; expenses?: string }
    >;
  } | null;
  if (!calc?.currencies?.length) return null;
  return (
    <div className="ad-tiles ad-tiles-sales">
      {calc.currencies.map((cur) => {
        const b = calc.by_currency?.[cur];
        if (!b) return null;
        return (
          <div key={cur} className="ad-tile">
            <span className="ad-tile-v">
              {Number(b.net ?? 0).toLocaleString('en-US')} {cur}
            </span>
            <span className="ad-tile-l">
              net · {Number(b.sale ?? 0).toLocaleString('en-US')} sale ·{' '}
              {Number(b.received ?? 0).toLocaleString('en-US')} received
              {Number(b.remaining ?? 0) > 0
                ? ` · ${Number(b.remaining).toLocaleString('en-US')} remaining`
                : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AttachmentsSection({
  dealId,
  deal,
  onChanged,
}: {
  dealId: string;
  deal: PrivateDealAdmin;
  onChanged: () => void;
}) {
  const { accountingAdmin } = useApi();
  const options = useOptions();
  const slots = choices(options, 'accounting.deal_attachment_slot');
  const [slot, setSlot] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);

  const attachments =
    (deal.attachments as unknown as Array<{
      id: string;
      slot: string;
      original_name: string;
      file_url: string;
    }>) ?? [];

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      await accountingAdmin.uploadDealAttachment(dealId, file, slot || undefined);
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not upload.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (attachmentId: string) => {
    setBusy(true);
    setError(null);
    try {
      await accountingAdmin.deleteDealAttachment(dealId, attachmentId);
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not remove it.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ad-dsec">
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">Files</h2>
        <span className="ad-dsec-n">
          receipts, contracts, images — slotted, served by link
        </span>
      </div>
      {error && <DeskBanner>{error}</DeskBanner>}
      <div className="ad-reachrow" style={{ marginBottom: 10 }}>
        <select className="ad-inlsel" value={slot} onChange={(e) => setSlot(e.target.value)}>
          <option value="">Slot: other</option>
          {slots.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="ad-rowbtn" style={{ cursor: busy ? 'default' : 'pointer' }}>
          Upload file…
          <input
            type="file"
            style={{ display: 'none' }}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      {attachments.length === 0 ? (
        <p className="dz-state">No files yet.</p>
      ) : (
        <div className="ad-card ad-logins">
          {attachments.map((a) => (
            <div key={a.id} className="ad-recrow">
              <span className="ad-reck">{label(slots, a.slot) || a.slot}</span>
              <span className="ad-recv">
                <a href={a.file_url} target="_blank" rel="noreferrer">
                  {a.original_name}
                </a>
              </span>
              <button
                type="button"
                className="ad-rowbtn is-danger"
                disabled={busy}
                onClick={() => setRemoving({ id: a.id, name: a.original_name })}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {removing && (
        <ConfirmDialog
          message={`Remove “${removing.name}” from this deal's files?`}
          okLabel="Remove"
          danger
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const r = removing;
            setRemoving(null);
            void remove(r.id);
          }}
        />
      )}
    </section>
  );
}

function emptyDraft(): Draft {
  const d: Draft = {};
  for (const k of CORE_TEXT_FIELDS) d[k] = '';
  for (const k of CHOICE_FIELDS) d[k] = '';
  for (const [k] of MONEY_FIELDS) {
    d[k] = '';
    d[`${k}_currency`] = '';
  }
  d.status = 'lead';
  d.priority = 'medium';
  d.pay_status = 'unpaid';
  d.seller_pay_status = 'unpaid';
  d.commission_type = 'pct';
  return d;
}

function choices(options: OptionsMap | null, key: string): Choice[] {
  return (options?.[key] as Choice[] | undefined) ?? [];
}

function label(list: Choice[], value: string): string {
  return list.find((c) => c.value === value)?.label ?? value;
}
