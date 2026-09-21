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
 * **Not ported, flagged (G-COL-1 / G-COL-2, `docs/ADMIN_ARCHITECTURE.md` §2):**
 *  - the overview strip (Collectors · VIP · Active 30d · Engaged, `:32634`) —
 *    computed client-side from the full roster in the old app; the roster here
 *    is paginated and no aggregate endpoint exists (the Dashboard's Collectors
 *    section carries total/active, which is what Phase 29 chose to serve);
 *  - the "Recently active" / "Most purchases" sorts (`:32626-32630`) — they
 *    rank by activity/purchase rollups the list endpoint does not carry;
 *    `ordering` serves name and created only.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useOptions } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { Choice, CollectorAdmin, CollectorAdminQuery } from '../../api/types';
import { useListController } from '../shared/useListController';
import { CollectorForm } from './CollectorForm';
import { CollectorsController } from './CollectorsController';
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
