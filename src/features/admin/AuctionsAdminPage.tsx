/**
 * AuctionsAdminPage — `/admin/auctions`, "Live Auctions" (`auctionsView()`,
 * `darz-studio.html:31677`) over backend Phase 8's auction admin.
 *
 * Ported content:
 *  - the search box ("Search auctions…", `:31688`) and the status filter —
 *    here the model's OWN statuses (draft/scheduled/live/closed/cancelled
 *    from options) instead of the old derived live/upcoming/ended set;
 *    search is client-side over the loaded page (the admin list takes no
 *    params — same G-CAT-3 shape);
 *  - the row anatomy: title · status pill · the sale window · lots count;
 *  - ＋ New auction with the create serializer's exact fields (title ·
 *    description · currency · window).
 *
 * **Not ported, stated:**
 *  - the "Auction announcement" theme card (`:31694`) — theme copy keys,
 *    the D17 family; it belongs to App Design when D17 lands;
 *  - the results sub-tab (`aucResultSweep`) — the external results DB has
 *    its own desk later; Registrations is its own route (the nav's
 *    "Register to Bid" tab), not a sub-tab.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { Auction, Choice } from '../../api/types';
import { DeskAction, DeskBanner, DeskPage, DataTable, type Column } from './kit';
import './admin.css';

export function AuctionsAdminPage() {
  const { auctionsAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();

  const statuses = choices(options, 'auctions.auction_status');
  const currencies = choices(options, 'currency');

  const [auctions, setAuctions] = useState<Auction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    auctionsAdmin.auctions({ per_page: 100 }).then(
      (page) => setAuctions(page.results),
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the auctions.'),
    );
  }, [auctionsAdmin]);
  useEffect(load, [load]);

  const rows = useMemo(() => {
    let list = auctions ?? [];
    const term = q.trim().toLowerCase();
    if (term)
      list = list.filter((a) =>
        `${a.title} ${a.description ?? ''}`.toLowerCase().includes(term),
      );
    if (status) list = list.filter((a) => a.status === status);
    return list;
  }, [auctions, q, status]);

  const columns: ReadonlyArray<Column<Auction>> = [
    {
      key: 'title',
      header: 'Auction',
      cell: (a) => (
        <>
          <span className="ad-cellmain">{a.title}</span>
          {a.description && <span className="ad-cellsub">{a.description.slice(0, 80)}</span>}
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (a) => <AuctionPill status={a.status} label={label(statuses, a.status)} />,
    },
    {
      key: 'window',
      header: 'Window',
      className: 'ad-when',
      cell: (a) => (
        <>
          <span className="ad-cellmain">
            {new Date(a.starts_at).toLocaleString('en-GB', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <span className="ad-cellsub">
            →{' '}
            {new Date(a.ends_at).toLocaleString('en-GB', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </>
      ),
    },
    { key: 'lots', header: 'Lots', cell: (a) => a.lots_count ?? '—' },
    { key: 'currency', header: 'Currency', cell: (a) => a.currency },
    {
      key: 'open',
      header: '',
      cell: (a) => (
        <button
          type="button"
          className="ad-rowbtn"
          onClick={() => navigate(`/admin/auctions/${a.id}`)}
        >
          Open
        </button>
      ),
    },
  ];

  return (
    <DeskPage
      title="Live Auctions"
      action={<DeskAction onClick={() => setCreating(true)}>＋ New auction</DeskAction>}
      toolbar={
        <>
          <label className="ad-filter">
            <span className="ad-filter-l">Search</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search auctions…"
            />
          </label>
          <label className="ad-filter">
            <span className="ad-filter-l">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All status</option>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </>
      }
    >
      {error && <DeskBanner>{error}</DeskBanner>}
      {!auctions && !error && <p className="dz-state">Loading…</p>}

      {creating && (
        <NewAuctionForm
          currencies={currencies}
          onClose={() => setCreating(false)}
          onSaved={(a) => {
            setCreating(false);
            load();
            navigate(`/admin/auctions/${a.id}`);
          }}
        />
      )}

      {auctions &&
        (rows.length ? (
          <DataTable label="Auctions" rows={rows} columns={columns} rowKey={(a) => a.id} />
        ) : (
          <p className="dz-state">
            {auctions.length
              ? 'No auctions match.'
              : 'No auctions yet — create the first sale.'}
          </p>
        ))}
    </DeskPage>
  );
}

/** live→ok · scheduled/draft→res · closed/cancelled→neut/gone. */
export function AuctionPill({ status, label: text }: { status: string; label: string }) {
  const cls =
    status === 'live'
      ? 'ok'
      : status === 'cancelled'
        ? 'gone'
        : status === 'closed'
          ? 'neut'
          : 'res';
  return <span className={`ad-stpill is-${cls}`}>{text || status}</span>;
}

function NewAuctionForm({
  currencies,
  onClose,
  onSaved,
}: {
  currencies: Choice[];
  onClose: () => void;
  onSaved: (a: Auction) => void;
}) {
  const { auctionsAdmin } = useApi();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    if (!title.trim() || !currency || !startsAt || !endsAt) {
      setError('Title, currency and the sale window are all required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSaved(
        await auctionsAdmin.createAuction({
          title: title.trim(),
          description,
          currency,
          starts_at: new Date(startsAt).toISOString(),
          ends_at: new Date(endsAt).toISOString(),
        }),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create the auction.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-card ad-form">
      <div className="ad-form-h">New auction</div>
      <div className="ad-form-grid">
        <label className="ad-field">
          <span className="ad-filter-l">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
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
          <span className="ad-filter-l">Starts</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </label>
        <label className="ad-field">
          <span className="ad-filter-l">Ends</span>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </label>
        <label className="ad-field ad-field--wide">
          <span className="ad-filter-l">Description · optional</span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
          Create auction
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
