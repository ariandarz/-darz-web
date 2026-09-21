/**
 * CollectorsPage — `/admin/collectors`, the roster (`users()`,
 * `darz-studio.html:32610`).
 *
 * Ported content: the search's own scope ("Search collectors — name, email,
 * phone, city…", `:32639` — `interests` is dropped from the placeholder
 * because the server's `search` does not cover preferences, and promising it
 * would lie), the tier filter, the sort row (`:32638`'s options mapped onto
 * the server's real `ordering` tokens — see the note below), and the
 * tier-coloured chip.
 *
 * Assembled from the desk kit; what is this desk's own: its columns, its
 * filters' vocabulary (tiers and access statuses from `GET /api/options/`,
 * never hardcoded), and the create action. Everything row-level — edit, keys,
 * login history, remove — lives on the detail (`/admin/collectors/:id`), the
 * modern-mechanics form of the old `colDetail(id)` workspace.
 *
 * **The overview strip is back** (G-4, approved 2026-09-21) — with three of
 * the old four tiles, from three `per_page: 1` counts rather than a new
 * endpoint. `collectorTiles.ts` carries which two of the old tiles could not
 * be rebuilt and why; the short version is that **Active 30d** and **Engaged**
 * need a last-activity rollup per collector that no list row and no aggregate
 * endpoint provides, so the third tile is **Active** — access rather than
 * behaviour — and says so rather than borrowing the old tile's name.
 *
 * **Still not ported, flagged (G-COL-2, `docs/ADMIN_ARCHITECTURE.md` §2):**
 * the "Recently active" / "Most purchases" sorts (`:32626-32630`) — they rank
 * by the same activity/purchase rollups; `ordering` serves name and created
 * only.
 *
 * **"Notify collectors" (`:32614`) is missing and blocked, not overlooked.**
 * The old button is "Web Push with preset messages + recipient choice" — and
 * push is the one collector feature this app cannot ship at all: no endpoint
 * publishes the VAPID public key (**G-P13-1**, re-checked 2026-09-18), so
 * there is nothing to subscribe a browser with. A button that opened a
 * composer which could never send is worse than its absence; this note is the
 * absence, stated. The heading is "Collectors" rather than the old
 * "Collectors · CRM" for the same reason the nav says Collectors: "CRM" named
 * a desk group in the old panel that this one reaches by tabs.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { Choice, CollectorAdmin, CollectorAdminQuery } from '../../api/types';
import { useListController } from '../shared/useListController';
import { CollectorForm } from './CollectorForm';
import { CollectorsController } from './CollectorsController';
import { EMPTY_COUNTS, collectorTiles, type CollectorCounts } from './collectorTiles';
import {
  DeskAction,
  DeskList,
  DeskPage,
  SearchFilter,
  SelectFilter,
  type Column,
} from './kit';
import './admin.css';

const SORTS = [
  { value: '-created', label: 'Newest first' },
  { value: 'created', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
  { value: '-name', label: 'Name Z–A' },
];

export function CollectorsPage() {
  const { adminAccounts } = useApi();
  const options = useOptions();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const { state, setQuery, setPage } = useListController<CollectorAdmin, CollectorAdminQuery>(
    () => new CollectorsController(adminAccounts),
  );

  /* Three counts, read once. Deliberately NOT re-read when the desk's filters
     change: the old strip was computed from the full roster so the totals stay
     true whatever is filtered below (`:32632`). `per_page: 1` because only
     `pagination.total_count` is wanted — the row itself is discarded. */
  const [counts, setCounts] = useState<CollectorCounts>(EMPTY_COUNTS);
  useEffect(() => {
    let alive = true;
    const count = (query: CollectorAdminQuery) =>
      adminAccounts
        .collectors({ ...query, per_page: 1 })
        .then((page) => page.pagination.total_count)
        .catch(() => null);
    void Promise.all([
      count({}),
      count({ tier: 'vip' }),
      count({ access_status: 'active' }),
    ]).then(([total, vip, active]) => {
      if (alive) setCounts({ total, vip, active });
    });
    return () => {
      alive = false;
    };
  }, [adminAccounts]);

  const tiers = choices(options, 'accounts.collector_tier');
  const statuses = choices(options, 'accounts.collector_access_status');

  const columns: ReadonlyArray<Column<CollectorAdmin>> = [
    {
      key: 'name',
      header: 'Name',
      cell: (c) => (
        <>
          <span className="ad-cellmain">{c.display_name}</span>
          {c.full_name && c.full_name !== c.display_name && (
            <span className="ad-cellsub">{c.full_name}</span>
          )}
        </>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      cell: (c) => (
        <>
          {c.email && <span className="ad-cellmain">{c.email}</span>}
          {c.phone && <span className="ad-cellsub">{c.phone}</span>}
          {!c.email && !c.phone && '—'}
        </>
      ),
    },
    { key: 'city', header: 'City', cell: (c) => c.city || '—' },
    {
      key: 'tier',
      header: 'Tier',
      cell: (c) =>
        c.tier ? (
          <span className={`ad-chip ad-tier-${c.tier}`}>{label(tiers, c.tier)}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'access',
      header: 'Access',
      cell: (c) => label(statuses, c.access_status ?? '') || '—',
    },
    {
      key: 'created',
      header: 'Since',
      className: 'ad-when',
      cell: (c) => new Date(c.created_at).toLocaleDateString('en-GB'),
    },
    {
      key: 'open',
      header: '',
      cell: (c) => (
        <button
          type="button"
          className="ad-rowbtn"
          onClick={() => navigate(`/admin/collectors/${c.id}`)}
        >
          Open
        </button>
      ),
    },
  ];

  return (
    <DeskPage
      wide
      title="Collectors"
      action={<DeskAction onClick={() => setCreating(true)}>＋ New collector</DeskAction>}
      toolbar={
        <>
          <SearchFilter
            label="Search"
            value={state.query.search}
            onChange={(search) => setQuery({ search })}
            placeholder="Search collectors — name, email, phone, city…"
          />
          <SelectFilter
            label="Tier"
            anyLabel="All tiers"
            value={state.query.tier}
            onChange={(tier) => setQuery({ tier })}
            choices={tiers}
          />
          <SelectFilter
            label="Access"
            anyLabel="All statuses"
            value={state.query.access_status}
            onChange={(access_status) => setQuery({ access_status })}
            choices={statuses}
          />
          <SelectFilter
            label="Sort"
            anyLabel="Newest first"
            value={state.query.ordering}
            onChange={(ordering) =>
              setQuery({ ordering: ordering as CollectorAdminQuery['ordering'] })
            }
            choices={SORTS.slice(1)}
          />
        </>
      }
    >
      {/* `:32612`'s line under the heading, verbatim. The fidelity pass found
          this desk was one of three that had dropped the old panel's own
          subtitle. */}
      <p className="ad-desksub">
        Every collector as a file — open one to view &amp; edit all their details, purchases,
        pricelists and activity.
      </p>

      {creating && (
        <CollectorForm
          title="New collector"
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false);
            navigate(`/admin/collectors/${saved.id}`);
          }}
        />
      )}

      {/* `:32634`'s overview strip. The tiles read the whole roster, not the
          filtered page — see `collectorTiles.ts`. */}
      <div className="ad-tiles ad-tiles-sales">
        {collectorTiles(counts).map((t) => (
          <div key={t.key} className="ad-tile">
            <span className="ad-tile-v">{t.value}</span>
            <span className="ad-tile-l">
              {t.label}
              {t.note ? ` · ${t.note}` : ''}
            </span>
          </div>
        ))}
      </div>

      <DeskList
        label="Collectors"
        status={state.status}
        error={state.error}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(c) => c.id}
        empty="No collectors match."
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
