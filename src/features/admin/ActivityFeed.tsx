/**
 * ActivityFeed — the collector self-logged event log (view · save · search ·
 * login), `GET /api/crm/admin/activity/` (backend Phase 28). The other half of
 * the old panel's "Requests & Activity" tab: `activity()`
 * (`darz-studio.html:29385`) mixed the request cards with these events in one
 * scrolling page; here the tab keeps its old name and a segment switches the
 * two halves — same content, one modern surface.
 *
 * Read-only by design (the collector wrote these rows about themselves; the
 * desk observes). Filter by kind from `crm.activity_kind` — never a hardcoded
 * label lookup — and by collector when arrived at from a collector's
 * workspace (`?collector=` in the URL).
 */
import type { CrmService } from '../../api/services';
import type { CollectorActivityAdmin } from '../../api/types';
import { useListController } from '../shared/useListController';
import { ActivityFeedController, type ActivityQuery } from './ActivityFeedController';
import { useOptions } from '../../api/hooks';
import type { Choice } from '../../api/types';
import { DeskList, SelectFilter, type Column } from './kit';
import './admin.css';

export function ActivityFeed({
  crm,
  initialCollector,
}: {
  crm: CrmService;
  initialCollector?: string;
}) {
  const options = useOptions();
  const kinds = (options?.['crm.activity_kind'] as Choice[] | undefined) ?? [];
  const { state, setQuery, setPage } = useListController<
    CollectorActivityAdmin,
    ActivityQuery
  >(() => new ActivityFeedController(crm, { collector: initialCollector }));

  const columns: ReadonlyArray<Column<CollectorActivityAdmin>> = [
    {
      key: 'when',
      header: 'When',
      className: 'ad-when',
      cell: (a) =>
        new Date(a.created_at).toLocaleString('en-GB', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
    },
    {
      key: 'collector',
      header: 'Collector',
      cell: (a) => a.collector?.display_name ?? '—',
    },
    {
      key: 'kind',
      header: 'Did',
      cell: (a) => (
        <span className={`ad-chip ad-act-${a.kind}`}>
          {kinds.find((k) => k.value === a.kind)?.label ?? a.kind}
        </span>
      ),
    },
    {
      key: 'artwork',
      header: 'Artwork',
      cell: (a) =>
        a.artwork
          ? a.artwork.artist
            ? `${a.artwork.artist.display_name} — ${a.artwork.title}`
            : a.artwork.title
          : '—',
    },
    {
      key: 'detail',
      header: 'Detail',
      cell: (a) => metadataLine(a.metadata),
    },
  ];

  return (
    <>
      <div className="ad-toolbar">
        <SelectFilter
          label="Kind"
          anyLabel="All kinds"
          value={state.query.kind}
          onChange={(kind) => setQuery({ kind })}
          choices={kinds}
        />
        {state.query.collector && (
          <button
            type="button"
            className="ad-ghostbtn"
            style={{ alignSelf: 'flex-end' }}
            onClick={() => setQuery({ collector: undefined })}
          >
            One collector — show all
          </button>
        )}
      </div>
      <DeskList
        label="Collector activity"
        status={state.status}
        error={state.error}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(a) => a.id}
        empty="No activity recorded yet."
      />
    </>
  );
}

/** The one metadata worth a line — a search's own query text. Everything else
 * stays a compact fallback rather than a JSON dump. */
function metadataLine(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return '—';
  const m = metadata as Record<string, unknown>;
  if (typeof m.query === 'string' && m.query.trim()) return `“${m.query.trim()}”`;
  const keys = Object.keys(m);
  return keys.length ? keys.map((k) => `${k}: ${String(m[k])}`).join(' · ') : '—';
}
