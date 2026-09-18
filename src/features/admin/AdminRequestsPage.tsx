/**
 * AdminRequestsPage — `/admin/requests`. The unified CRM request feed: every
 * collector action (Buy now / 24h hold / Request viewing / Make an offer)
 * arrives here, filterable by kind, status and archived, with a per-row
 * status transition. This is the "Admin receives the action" end of flow 1.
 *
 * Assembled from the desk kit (`./kit`) rather than hand-built chrome: the
 * page shell, the filter controls, the four-way loading/error/empty/rows body,
 * the table and the pager all come from there. What is left here is what is
 * actually this desk's — its columns, its filters' vocabulary, and the
 * transition action. That is the shape every other desk in the panel takes;
 * see `docs/ADMIN_ARCHITECTURE.md`.
 *
 * `collector`/`artwork` are nested objects now, not bare uuids
 * (`docs/FLOW_1_API_GAPS.md` G-F1-7) — the feed shows a real name and work
 * title. Statuses come from `GET /api/options/`'s `crm.request_status_by_kind`
 * (G-F1-4, derived live from the backend's own guarded state machine so it
 * can never drift) — never a hardcoded label lookup (CLAUDE.md). The per-row
 * "Move to…" control uses that row's own `allowed_transitions`, so it only
 * ever offers a legal next status.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type {
  AdminRequest,
  AdminRequestQuery,
  Choice,
  RequestStatusByKind,
} from '../../api/types';
import { useListController } from '../shared/useListController';
import { AdminRequestsController } from './AdminRequestsController';
import { DeskList, DeskPage, SelectFilter, ToggleFilter, type Column } from './kit';
import './admin.css';

/** The kinds the collector flow can produce, plus the rest of the closed set. */
const KINDS = [
  'information',
  'price',
  'availability',
  'hold',
  'offer',
  'viewing',
  'purchase',
  'message',
] as const;

export function AdminRequestsPage() {
  const { crm, options } = useApi();
  // The opening filter comes from the URL so a Dashboard tile lands on exactly
  // the rows it counted — the old panel's own rule (`darz-studio.html:21349`,
  // "a counter ALWAYS equals the list that opens when it is tapped"). Read once,
  // as the controller's initial query: after that the controller owns the
  // query, and re-reading it on every render would fight the user's filtering.
  const [params] = useSearchParams();
  const { state, setQuery, setPage, reload } = useListController<
    AdminRequest,
    AdminRequestQuery
  >(
    () =>
      new AdminRequestsController(crm, {
        kind: params.get('kind') ?? undefined,
        status: params.get('status') ?? undefined,
      }),
  );
  const [choices, setChoices] = useState<OptionsMap | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    options.all().then(
      (map) => alive && setChoices(map),
      () => alive && setChoices({}),
    );
    return () => {
      alive = false;
    };
  }, [options]);

  const statusByKind = requestStatusByKind(choices);
  // The filter dropdown: scoped to the selected kind's own vocabulary once one
  // is chosen, else every status across every kind (deduped).
  const filterStatuses = state.query.kind
    ? (statusByKind[state.query.kind] ?? [])
    : unionOfStatuses(statusByKind);

  const transition = async (id: string, toStatus: string) => {
    if (!toStatus || busyId) return; // one transition at a time
    setBusyId(id);
    setActionError(null);
    try {
      await crm.transitionRequest(id, toStatus);
      await reload();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  };

  const columns: ReadonlyArray<Column<AdminRequest>> = [
    {
      key: 'when',
      header: 'When',
      className: 'ad-when',
      cell: (r) => whenLabel(r.created_at),
    },
    {
      key: 'kind',
      header: 'Kind',
      cell: (r) => <span className={`ad-chip ${r.kind}`}>{titleCase(r.kind)}</span>,
    },
    {
      key: 'collector',
      header: 'Collector',
      cell: (r) => r.collector?.display_name ?? shortId(String(r.collector)),
    },
    { key: 'artwork', header: 'Artwork', cell: (r) => artworkLabel(r.artwork) },
    { key: 'detail', header: 'Detail', cell: (r) => detailLine(r.detail) },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <>
          {titleCase(r.status)}
          {r.unread_count > 0 && (
            <span className="ad-unread" title={`${r.unread_count} unread reply`}>
              {r.unread_count}
            </span>
          )}
          {r.admin_archived && <span className="ad-archived-chip">Archived</span>}
        </>
      ),
    },
    {
      key: 'move',
      header: 'Move to',
      cell: (r) => (
        <select
          value=""
          onChange={(e) => void transition(r.id, e.target.value)}
          aria-label={`Move request ${shortId(r.id)} to another status`}
          disabled={r.allowed_transitions.length === 0}
        >
          <option value="">Move to…</option>
          {r.allowed_transitions.map((value) => (
            <option key={value} value={value}>
              {statusLabel(statusByKind, r.kind, value)}
            </option>
          ))}
        </select>
      ),
    },
  ];

  return (
    <DeskPage
      title="Requests"
      toolbar={
        <>
          <SelectFilter
            label="Kind"
            anyLabel="All kinds"
            value={state.query.kind}
            onChange={(kind) => setQuery({ kind })}
            choices={KINDS.map((k) => ({ value: k, label: titleCase(k) }))}
          />
          <SelectFilter
            label="Status"
            anyLabel="All statuses"
            value={state.query.status}
            onChange={(status) => setQuery({ status })}
            choices={filterStatuses}
          />
          <ToggleFilter
            label="Archived only"
            checked={state.query.archived ?? false}
            onChange={(on) => setQuery({ archived: on || undefined })}
          />
        </>
      }
    >
      <DeskList
        label="Requests"
        status={state.status}
        error={state.error}
        actionError={actionError}
        rows={state.results}
        pagination={state.pagination}
        onPage={setPage}
        columns={columns}
        rowKey={(r) => r.id}
        busyKey={busyId}
        empty="No requests match these filters."
      />
    </DeskPage>
  );
}

// --- helpers ---------------------------------------------------------------

/** `crm.request_status_by_kind` on `GET /api/options/` (G-F1-4) — the legal
 * status vocabulary per kind, derived live from the backend's own guarded
 * state machine. Never hardcode this lookup (CLAUDE.md). */
function requestStatusByKind(map: OptionsMap | null): RequestStatusByKind {
  if (!map) return {};
  return (map['crm.request_status_by_kind'] as RequestStatusByKind | undefined) ?? {};
}

function unionOfStatuses(byKind: RequestStatusByKind): Choice[] {
  const seen = new Map<string, string>();
  Object.values(byKind).forEach((choices) => {
    choices.forEach((c) => seen.set(c.value, c.label));
  });
  return Array.from(seen, ([value, label]) => ({ value, label }));
}

function statusLabel(byKind: RequestStatusByKind, kind: string, value: string): string {
  return byKind[kind]?.find((c) => c.value === value)?.label ?? titleCase(value);
}

function artworkLabel(artwork: AdminRequest['artwork']): string {
  if (!artwork) return '—';
  return artwork.artist ? `${artwork.artist.display_name} — ${artwork.title}` : artwork.title;
}

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : s;
}

function shortId(id: string): string {
  return id ? id.slice(0, 8) : '—';
}

/** The offer amount is the one detail worth showing inline in the feed. */
function detailLine(detail: unknown): string {
  if (!detail || typeof detail !== 'object') return '—';
  const d = detail as Record<string, unknown>;
  // v0.1 Send Inquiry: the collector's message travels in `detail.message`
  if (typeof d.message === 'string' && d.message.trim()) return `“${d.message.trim()}”`;
  if (d.amount != null) {
    const amount = Number(d.amount);
    const shown = Number.isFinite(amount) ? amount.toLocaleString('en-US') : String(d.amount);
    return [shown, d.currency].filter(Boolean).join(' ');
  }
  return '—';
}

function whenLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}
