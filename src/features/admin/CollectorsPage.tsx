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
 * **The overview strip** is the old four — Collectors · VIP · Active 30d ·
 * Engaged (`:32630`) — from `GET …/collectors/summary/` (G-COL-1); see
 * `collectorTiles.ts`.
 *
 * **Sorts (G-COL-2):** the old list (`:32633`) — "Recently active" (the old
 * default, `-activity`), "Name A–Z", "Tier", "Most purchases" (`-purchases`) —
 * on the server's `ordering`. The desk OPENS on Recently active, as the old
 * one did. "Tier" has no server ordering and is not offered; "Newest first"
 * (the unset option), "Oldest first" and "Name Z–A" are this desk's earlier
 * additions, kept. The rows gain the old card's two rollups (`:32649`,
 * `:32654`): Purchases (`purchase_count`) and "Last active <date>" / "No
 * activity yet" (`last_activity_at`). Both are list-only (C-16) — this desk
 * never writes a row back, edits live on the detail.
 *
 * **"Notify collectors" (`:32614`) is missing and blocked, not overlooked.**
 * The old button is "Web Push with preset messages + recipient choice". The
 * VAPID public key IS served now (G-P13-1 closed), so a browser could
 * subscribe — but there is no admin endpoint that SENDS a push, so a composer
 * here could never deliver. A button that opened a composer which could never
 * send is worse than its absence; this note is the absence, stated. The
 * heading is "Collectors" rather than the old
 * "Collectors · CRM" for the same reason the nav says Collectors: "CRM" named
 * a desk group in the old panel that this one reaches by tabs.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type {
  Choice,
  CollectorAdmin,
  CollectorAdminQuery,
  CollectorDeskSummary,
} from '../../api/types';
import { useListController } from '../shared/useListController';
import { CollectorForm } from './CollectorForm';
import { CollectorsController } from './CollectorsController';
import { collectorTiles, lastActiveLine } from './collectorTiles';
import {
  DeskAction,
  DeskList,
  DeskPage,
  SearchFilter,
  SelectFilter,
  type Column,
} from './kit';
import './admin.css';

/** `:32633`'s sort list on the server's tokens, then this desk's earlier
 * additions. The unset option is the server default, "Newest first". */
const SORTS: Array<{ value: NonNullable<CollectorAdminQuery['ordering']>; label: string }> = [
  { value: '-activity', label: 'Recently active' },
  { value: 'name', label: 'Name A–Z' },
  { value: '-purchases', label: 'Most purchases' },
  { value: 'created', label: 'Oldest first' },
  { value: '-name', label: 'Name Z–A' },
];

export function CollectorsPage() {
  const { adminAccounts } = useApi();
  const options = useOptions();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const { state, setQuery, setPage } = useListController<CollectorAdmin, CollectorAdminQuery>(
    // The old desk opened on "Recently active" (`COLF.sort||'recent'`, :32633).
    () => new CollectorsController(adminAccounts, { ordering: '-activity' }),
  );

  /* The strip's four counts (G-COL-1), read once — deliberately not re-read
     when the filters change: the old strip counts the full roster (:32626). */
  const [summary, setSummary] = useState<CollectorDeskSummary | null>(null);
  useEffect(() => {
    let alive = true;
    adminAccounts.collectorsSummary().then(
      (s) => alive && setSummary(s),
      () => alive && setSummary(null),
    );
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
      // :32654 — the old card's Purchases count
      key: 'purchases',
      header: 'Purchases',
      cell: (c) => (c.purchase_count == null ? '—' : c.purchase_count),
    },
    {
      // :32649 — "Last active <date>" / "No activity yet"
      key: 'last',
      header: 'Last active',
      className: 'ad-when',
      cell: (c) => lastActiveLine(c.last_activity_at).replace(/^Last active /, ''),
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
            choices={SORTS}
          />
        </>
      }
      subtitle={
        /* `:32612`'s line under the heading, verbatim. The fidelity pass found
          this desk was one of three that had dropped the old panel's own
          subtitle. */
        <>
          Every collector as a file — open one to view &amp; edit all their details, purchases,
          pricelists and activity.
        </>
      }
      strip={
        <>
          {/* `:32630`'s overview strip. The tiles read the whole roster, not the
          filtered page — see `collectorTiles.ts`. */}
          <div className="ad-tiles ad-tiles-sales">
            {collectorTiles(summary).map((t) => (
              <div key={t.key} className="ad-tile">
                <span className="ad-tile-v">{t.value}</span>
                <span className="ad-tile-l">{t.label}</span>
              </div>
            ))}
          </div>
        </>
      }
    >
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
