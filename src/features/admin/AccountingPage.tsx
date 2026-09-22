/**
 * AccountingPage — `/admin/accounting` (Owner group, owner-only end to end —
 * the backend's own `IsOwner` on every route), the four-ledger books over
 * backend Phase 11's accounting.
 *
 * The content model is the old desk's, already encoded server-side (the
 * services cite `acctSummary`/`acctConv` by name):
 *  - the four books — Darz · Koocheh · Personal · Expenses Arian — as the
 *    desk's segment;
 *  - the per-currency summary strip: income / expense / net / pending /
 *    salaries, NEVER summed across currencies (the service's own rule),
 *    plus the manual-rate converted-income line when present;
 *  - entries: date · type+category · person/position · amount (+FX
 *    converted) · status pill · note · receipt mark;
 *  - the month filter (`?month=YYYY-MM`), type and status filters.
 *
 * ＋ New entry / Edit carry the write serializer's fields — the essentials
 * grid plus the FX and sale-label grids. `book` is immutable on PATCH (the
 * serializer refuses it), so editing keeps the entry in its book.
 *
 * Later steps, stated: private deals, attachments (receipts), the Arian
 * duplicate review, the settlement view.
 */
import { useCallback, useEffect, useState } from 'react';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type {
  Choice,
  LedgerEntryAdmin,
  LedgerQuery,
  LedgerSummary,
  Paginated,
} from '../../api/types';
import { ListController } from '../shared/ListController';
import { useListController } from '../shared/useListController';
import { normaliseLedgerSummary } from './ledgerSummary';
import type { AccountingAdminService } from '../../api/services';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Segment } from '../../components';
import { AccountingDeals } from './AccountingDeals';
import { AccountingDuplicates } from './AccountingDuplicates';
import { AccountingSettlement } from './AccountingSettlement';
import {
  ConfirmDialog,
  DeskAction,
  DeskBanner,
  DeskList,
  DeskPage,
  SelectFilter,
  type Column,
} from './kit';
import './admin.css';

class LedgerController extends ListController<LedgerEntryAdmin, LedgerQuery> {
  private readonly accounting: AccountingAdminService;
  constructor(accounting: AccountingAdminService, initial: LedgerQuery = {}) {
    super(initial);
    this.accounting = accounting;
  }
  protected fetchPage(query: LedgerQuery): Promise<Paginated<LedgerEntryAdmin>> {
    return this.accounting.ledger(query);
  }
}

export function AccountingPage() {
  const { accountingAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = resolveView(params.get('view'));

  const books = choices(options, 'accounting.book');
  const types = choices(options, 'accounting.entry_type');
  const statuses = choices(options, 'accounting.ledger_status');

  const { state, setQuery, setPage, reload } = useListController<
    LedgerEntryAdmin,
    LedgerQuery
    /* The book is seeded from the URL so `?book=` is a real link — the entry
       page's "back to the books" uses it to return to the book the entry is
       in, and a book is shareable. Read once, at construction: the Segment
       below is the only thing that changes it afterwards, and it writes the
       param back. */
  >(() => new LedgerController(accountingAdmin, { book: params.get('book') || 'darz' }));
  const book = state.query.book ?? 'darz';

  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const loadSummary = useCallback(() => {
    accountingAdmin.ledgerSummary(book, state.query.month).then(
      // `normaliseLedgerSummary`, not the raw body: a 200 with the wrong shape
      // passes the `summary &&` guard below and then throws on `.length`,
      // which blanks the WHOLE desk. See `ledgerSummary.ts`.
      (s) => setSummary(normaliseLedgerSummary(s)),
      () => setSummary(null),
    );
  }, [accountingAdmin, book, state.query.month]);
  useEffect(loadSummary, [loadSummary]);

  const [editing, setEditing] = useState<LedgerEntryAdmin | null | 'new'>(null);
  const [removing, setRemoving] = useState<LedgerEntryAdmin | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const remove = async (e: LedgerEntryAdmin) => {
    setActionError(null);
    try {
      await accountingAdmin.deleteEntry(e.id);
      await reload();
      loadSummary();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Could not remove the entry.');
    }
  };

  const columns: ReadonlyArray<Column<LedgerEntryAdmin>> = [
    {
      key: 'date',
      header: 'Date',
      className: 'ad-when',
      cell: (e) => new Date(e.entry_date).toLocaleDateString('en-GB'),
    },
    {
      key: 'what',
      header: 'Entry',
      cell: (e) => (
        <>
          <span className="ad-cellmain">
            {label(types, e.entry_type)}
            {e.category ? ` · ${e.category}` : ''}
          </span>
          {(e.person || e.position) && (
            <span className="ad-cellsub">
              {[e.person, e.position].filter(Boolean).join(' · ')}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      cell: (e) => (
        <>
          <span className={`ad-cellmain${e.entry_type === 'income' ? ' ad-inc' : ''}`}>
            {e.entry_type === 'expense' ? '−' : ''}
            {Number(e.amount).toLocaleString('en-US')} {e.currency}
          </span>
          {e.fx_converted && e.fx_target_currency && (
            <span className="ad-cellsub">
              ≈ {Number(e.fx_converted).toLocaleString('en-US')} {e.fx_target_currency}
            </span>
          )}
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (e) => (
        <span
          className={`ad-stpill is-${
            e.status === 'received' || e.status === 'paid'
              ? 'ok'
              : e.status === 'overdue'
                ? 'gone'
                : e.status === 'cancelled'
                  ? 'neut'
                  : 'res'
          }`}
        >
          {label(statuses, e.status)}
        </span>
      ),
    },
    {
      key: 'note',
      header: 'Note',
      cell: (e) => (
        <>
          {e.note || '—'}
          {e.has_receipt && <span className="ad-cellsub"> · receipt on file</span>}
        </>
      ),
    },
    {
      key: 'acts',
      header: '',
      cell: (e) => (
        <span className="ad-rowacts">
          <button
            type="button"
            className="ad-rowbtn"
            onClick={() => navigate(`/admin/accounting/entries/${e.id}`)}
            title="Receipts, payment status, and the Arian review"
          >
            Open
          </button>
          <button type="button" className="ad-rowbtn" onClick={() => setEditing(e)}>
            Edit
          </button>
          <button type="button" className="ad-rowbtn is-danger" onClick={() => setRemoving(e)}>
            Remove
          </button>
        </span>
      ),
    },
  ];

  if (view !== 'books') {
    return (
      <DeskPage
        wide
        title="Accounting"
        subtitle={accountingIntro(view, book)}
        action={
          <span className="ad-rowacts">
            <ViewSeg view={view} setParams={setParams} />
            {view === 'deals' && (
              <DeskAction onClick={() => navigate('/admin/accounting/deals/new')}>
                ＋ New deal
              </DeskAction>
            )}
          </span>
        }
      >
        {view === 'deals' && <AccountingDeals />}
        {view === 'duplicates' && <AccountingDuplicates />}
        {view === 'settlement' && <AccountingSettlement />}
      </DeskPage>
    );
  }

  return (
    <DeskPage
      wide
      title="Accounting"
      subtitle={accountingIntro(view, book)}
      action={
        <span className="ad-rowacts">
          <ViewSeg view={view} setParams={setParams} />
          <DeskAction onClick={() => setEditing('new')}>＋ New entry</DeskAction>
        </span>
      }
      toolbar={
        <>
          <SelectFilter
            label="Type"
            anyLabel="Income & expense"
            value={state.query.entry_type}
            onChange={(entry_type) => setQuery({ entry_type })}
            choices={types}
          />
          <SelectFilter
            label="Status"
            anyLabel="All statuses"
            value={state.query.status}
            onChange={(status) => setQuery({ status })}
            choices={statuses}
          />
          <label className="ad-filter">
            <span className="ad-filter-l">Month</span>
            <input
              type="month"
              value={state.query.month ?? ''}
              onChange={(e) => setQuery({ month: e.target.value || undefined })}
            />
          </label>
        </>
      }
    >
      <div className="ad-bookseg">
        <Segment<string>
          label="Book"
          options={books.map((b) => ({ value: b.value, content: b.label }))}
          value={book}
          onChange={(next) => {
            setQuery({ book: next });
            const p = new URLSearchParams(params);
            if (next === 'darz') p.delete('book');
            else p.set('book', next);
            setParams(p);
          }}
        />
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
                  net · {Number(b.income).toLocaleString('en-US')} in ·{' '}
                  {Number(b.expense).toLocaleString('en-US')} out
                  {Number(b.pending) > 0
                    ? ` · ${Number(b.pending).toLocaleString('en-US')} pending`
                    : ''}
                </span>
              </div>
            );
          })}
          {Object.entries(summary.converted_income).map(([cur, amt]) => (
            <div key={`conv-${cur}`} className="ad-tile">
              <span className="ad-tile-v">
                ≈ {Number(amt).toLocaleString('en-US')} {cur}
              </span>
              <span className="ad-tile-l">income at the manual rates</span>
            </div>
          ))}
        </div>
      )}

      {actionError && <DeskBanner>{actionError}</DeskBanner>}

      {editing && (
        <EntryForm
          book={book}
          existing={editing === 'new' ? null : editing}
          types={types}
          statuses={statuses}
          currencies={choices(options, 'currency')}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
            loadSummary();
          }}
        />
      )}

      <DeskList
        label="Ledger"
        status={state.status}
        error={state.error}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(e) => e.id}
        empty="No entries in this book yet."
      />

      {removing && (
        <ConfirmDialog
          message={`Remove this ${removing.entry_type} of ${Number(removing.amount).toLocaleString('en-US')} ${removing.currency}? The books change; the row is soft-deleted server-side.`}
          okLabel="Remove"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const e = removing;
            setRemoving(null);
            void remove(e);
          }}
        />
      )}
    </DeskPage>
  );
}

function ViewSeg({
  view,
  setParams,
}: {
  view: AccountingView;
  setParams: (p: URLSearchParams) => void;
}) {
  return (
    <Segment<AccountingView>
      label="Accounting view"
      options={[
        { value: 'books', content: 'Books' },
        { value: 'deals', content: 'Private Deals' },
        { value: 'duplicates', content: 'Duplicates' },
        { value: 'settlement', content: 'Settlement' },
      ]}
      value={view}
      onChange={(v) => {
        const next = new URLSearchParams();
        if (v !== 'books') next.set('view', v);
        setParams(next);
      }}
    />
  );
}

/**
 * The old desk's per-view intro line (`acctHead`, `darz-studio.html:23328-23335`)
 * — a different sentence for every book and every sub-tab, and this desk had
 * **none of them**. Found 2026-09-22 against `31-accounting`, which shows the
 * line sitting under the sub-nav on every view.
 *
 * Each is ported to its first sentences and no further. Every one of the six
 * ends with the same clause — "behind your passkey, synced privately across
 * your own devices and backed up daily" — and that clause is the old app's
 * localStorage-and-passkey architecture, not a promise this backend makes:
 * there is no passkey here (the desk is owner-only through the API's own
 * `IsOwner`), nothing syncs between devices because there is one database,
 * and the daily backup is that database's, not this desk's. Repeating it
 * would be telling an owner their money is protected by a mechanism that does
 * not exist.
 *
 * The books view takes its line from the BOOK, the way the old desk does;
 * `koocheh` and `personal` have their own, and `darz` gets the default.
 */
function accountingIntro(view: AccountingView, book: string): string {
  if (view === 'deals')
    return 'Privately manage your individual art deals — artwork, buyer, seller, commission, costs and profit — each one a simple, flexible file. Fill in only what you need; the totals update as you go.';
  if (view === 'duplicates')
    return 'Every payment Arian made, entered from the receipts one by one — who was paid, how much, why, for which project, with the tracking number, bank and method from the receipt. Each payment carries a duplicate-check status and an accounting status, so a receipt reviewed twice is flagged, never double-counted.';
  if (view === 'settlement')
    return 'A private worksheet to organise the Darz ownership settlement — costs by year, unpaid salary, partner contributions, inflation & interest, and a live final figure. Every number editable, totals live.';
  if (book === 'koocheh')
    return 'A separate book for the Koocheh brand — its own income, costs and totals, kept entirely apart from Darz. Add entries in seconds and export a clean report whenever you need one.';
  if (book === 'personal')
    return 'Your personal money — rent, debts, shopping and every other cost — in its own private book, separate from Darz and Koocheh. Track what you spend, what’s still owed, and where it goes.';
  return 'Your private money desk. Add income and costs in seconds, watch the monthly totals, and export a clean report whenever you need one.';
}

/** The desk's four sub-tabs. The old desk's own sub-nav had the four books,
 * Private deals and "Ownership settlement" as peers (`acctHead`); here the
 * books are one view with a book Segment inside it, and the other three are
 * peers of that. `duplicates` is new as a screen but not as a job — it is the
 * Expenses-Arian review the old desk ran inline. */
export type AccountingView = 'books' | 'deals' | 'duplicates' | 'settlement';

function resolveView(raw: string | null): AccountingView {
  return raw === 'deals' || raw === 'duplicates' || raw === 'settlement' ? raw : 'books';
}

function EntryForm({
  book,
  existing,
  types,
  statuses,
  currencies,
  onClose,
  onSaved,
}: {
  book: string;
  existing: LedgerEntryAdmin | null;
  types: Choice[];
  statuses: Choice[];
  currencies: Choice[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { accountingAdmin } = useApi();
  const [d, setD] = useState<Record<string, string>>(() => ({
    entry_type: existing?.entry_type ?? 'expense',
    category: existing?.category ?? '',
    amount: existing?.amount ?? '',
    currency: (existing?.currency as string | undefined) ?? '',
    entry_date: existing?.entry_date ?? new Date().toISOString().slice(0, 10),
    person: existing?.person ?? '',
    position: existing?.position ?? '',
    status: existing?.status ?? 'pending',
    note: existing?.note ?? '',
    fx_target_currency: (existing?.fx_target_currency as string | undefined) ?? '',
    fx_rate: existing?.fx_rate ?? '',
    fx_converted: existing?.fx_converted ?? '',
    artwork_label: existing?.artwork_label ?? '',
    artist_label: existing?.artist_label ?? '',
  }));
  const set = (k: string, v: string) => setD((prev) => ({ ...prev, [k]: v }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    if (!d.amount.trim() || !d.entry_date) {
      setError('An entry needs an amount and a date.');
      return;
    }
    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = {
      entry_type: d.entry_type,
      category: d.category.trim(),
      amount: d.amount.trim(),
      entry_date: d.entry_date,
      person: d.person.trim(),
      position: d.position.trim(),
      status: d.status,
      note: d.note.trim(),
      artwork_label: d.artwork_label.trim(),
      artist_label: d.artist_label.trim(),
    };
    if (d.currency) body.currency = d.currency;
    if (d.fx_target_currency) {
      body.fx_target_currency = d.fx_target_currency;
      if (d.fx_rate.trim()) body.fx_rate = d.fx_rate.trim();
      if (d.fx_converted.trim()) body.fx_converted = d.fx_converted.trim();
    }
    try {
      if (existing) await accountingAdmin.updateEntry(existing.id, body);
      else await accountingAdmin.createEntry({ ...body, book });
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save the entry.');
    } finally {
      setBusy(false);
    }
  };

  const f = (k: string, l: string, ph?: string, type?: string) => (
    <label className="ad-field" key={k}>
      <span className="ad-filter-l">{l}</span>
      <input
        type={type}
        value={d[k]}
        onChange={(e) => set(k, e.target.value)}
        placeholder={ph}
      />
    </label>
  );
  const sel = (k: string, l: string, opts: Choice[], any?: string) => (
    <label className="ad-field" key={k}>
      <span className="ad-filter-l">{l}</span>
      <select value={d[k]} onChange={(e) => set(k, e.target.value)}>
        {any !== undefined && <option value="">{any}</option>}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="ad-card ad-form">
      <div className="ad-form-h">
        {existing ? 'Edit entry' : `New entry · ${book}`}
        {existing && <span className="ad-subnote"> — the book is fixed at creation</span>}
      </div>
      <div className="ad-form-grid">
        {sel('entry_type', 'Type', types)}
        {f('category', 'Category', 'e.g. Salary, Sale, Rent')}
        {f('amount', 'Amount')}
        {sel('currency', 'Currency', currencies, '— default —')}
        {f('entry_date', 'Date', undefined, 'date')}
        {sel('status', 'Status', statuses)}
        {f('person', 'Person')}
        {f('position', 'Position')}
        {f('note', 'Note')}
      </div>
      <div className="ad-form-h">Manual FX · optional</div>
      <div className="ad-form-grid">
        {sel('fx_target_currency', 'Convert to', currencies, '— none —')}
        {f('fx_rate', 'Rate')}
        {f('fx_converted', 'Converted amount')}
      </div>
      <div className="ad-form-h">Sale labels · optional</div>
      <div className="ad-form-grid">
        {f('artwork_label', 'Artwork')}
        {f('artist_label', 'Artist')}
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
          {existing ? 'Save entry' : 'Add to the book'}
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
