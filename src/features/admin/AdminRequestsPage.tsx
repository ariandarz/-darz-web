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
 *
 * ## Phase 1 (2026-09-21) — what the old desk had, and what could be ported
 *
 * `docs/ADMIN_V1_AUDIT.md` §6.3 measured this desk against the real old one
 * (`darz-studio.html:29380`, capture `13-requests`) and found it thinner than
 * recorded. Two of the differences are closed here; three cannot be, and
 * saying which is the point of this block.
 *
 * **Closed:**
 *
 *  - **Search** (G-5, approved and served: `?search=` over collector name,
 *    artwork title and artist name). This was the desk's real hole — the
 *    busiest list in the panel, and the only one with no way to find a row.
 *  - **The thread is reachable from the row.** The unread badge has always
 *    been here; what was missing was anywhere to go with it, so an admin who
 *    saw "2 unread" went to `/admin/chat` and found the row again. The count
 *    is now the link, and it hands the row to `AdminThreadPage` as router
 *    state — which also gives that page the collector name it otherwise
 *    cannot look up (G-CHAT-1).
 *
 * **Not portable, and not stubbed:**
 *
 *  - **The All / Market / Auctions scope segment.** There is nothing to
 *    split: `Request.KIND_CHOICES` is eight market actions, and auction bids
 *    and paddle registrations are separate models with their own desks. The
 *    old segment divided one undifferentiated activity array; this backend
 *    made the division structural instead. A segment here could only ever
 *    read "Auctions 0".
 *  - **Archive.** `admin_archived` is readable and filterable (the toggle
 *    below) but **read-only** — `RequestAdminSerializer` writes nothing, and
 *    no endpoint sets it. Only Django admin can archive a request today. A
 *    button would need a backend action first.
 *  - **Assignee.** Same shape: filterable, never settable, and it comes back
 *    as a bare uuid with no name, while the team-user list that could resolve
 *    it is `IsOwner`. A filter whose values nobody can populate or read is
 *    worse than none, so it is left out until assignment exists.
 *
 * **Not built by choice:** the old desk's red urgency band ("7 have been
 * waiting too long") is **G-3**, still awaiting a decision — it needs a
 * threshold nobody has set, and inventing one would put a made-up deadline in
 * front of the team.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Segment } from '../../components';
import { ActivityFeed } from './ActivityFeed';
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
import {
  DeskList,
  DeskPage,
  SearchFilter,
  SelectFilter,
  ToggleFilter,
  type Column,
} from './kit';
import { ageLabel, countWaiting, requestUrgency, waitHours } from './requestUrgency';
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
  // The tab is the old panel's "Requests & Activity" — one name, two halves.
  // The segment switches them; ?view=activity (and ?collector=, from a
  // collector's workspace) opens directly on the log half.
  const [view, setView] = useState<'requests' | 'activity'>(
    params.get('view') === 'activity' ? 'activity' : 'requests',
  );
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
  /* `crm.request_initial_status` — each kind's "just arrived" state, published
     by the backend so the urgency rule never has to guess (G-DASH-1). Null
     until options land, which `requestUrgency` treats as "cannot tell", never
     as "new". */
  const initialByKind =
    (choices?.['crm.request_initial_status'] as Record<string, string> | undefined) ?? null;
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

  const waiting = countWaiting(state.results, initialByKind);

  const columns: ReadonlyArray<Column<AdminRequest>> = [
    {
      key: 'when',
      header: 'When',
      className: 'ad-when',
      cell: (r) => {
        const u = requestUrgency(r, initialByKind);
        return (
          <>
            <span className={`ad-urg is-${u.key}`} title={u.label} aria-label={u.label} />
            {whenLabel(r.created_at)}
            {u.key === 'waiting' && (
              <span className="ad-cellsub">{ageLabel(r.created_at)}</span>
            )}
          </>
        );
      },
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
          {r.admin_archived && <span className="ad-archived-chip">Archived</span>}
        </>
      ),
    },
    {
      key: 'thread',
      header: 'Conversation',
      cell: (r) => (
        /* `state={r}` is not decoration: there is no `GET /admin/requests/{id}/`,
           so the thread page can only name the collector from a row handed to
           it (G-CHAT-1). Arriving this way, it can. */
        <Link to={`/admin/chat/${r.id}`} state={r} className="ad-threadlink">
          {r.unread_count > 0 ? (
            <>
              <span
                className="ad-unread"
                title={`${r.unread_count} unread ${r.unread_count === 1 ? 'reply' : 'replies'}`}
              >
                {r.unread_count}
              </span>
              <span>{r.unread_count === 1 ? 'unread reply' : 'unread replies'}</span>
            </>
          ) : (
            <span className="ad-cellsub">Open thread</span>
          )}
        </Link>
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

  if (view === 'activity') {
    return (
      <DeskPage
        wide
        title="Requests & Activity"
        action={
          <Segment<'requests' | 'activity'>
            label="Requests or activity"
            options={[
              { value: 'requests', content: 'Requests' },
              { value: 'activity', content: 'Activity' },
            ]}
            value={view}
            onChange={setView}
          />
        }
      >
        <ActivityFeed crm={crm} initialCollector={params.get('collector') ?? undefined} />
      </DeskPage>
    );
  }

  return (
    <DeskPage
      wide
      title="Requests & Activity"
      action={
        <Segment<'requests' | 'activity'>
          label="Requests or activity"
          options={[
            { value: 'requests', content: 'Requests' },
            { value: 'activity', content: 'Activity' },
          ]}
          value={view}
          onChange={setView}
        />
      }
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
          <SearchFilter
            label="Search"
            value={state.query.search}
            placeholder="Collector, artwork or artist…"
            onChange={(search) => setQuery({ search })}
          />
        </>
      }
      subtitle={
        /* The old desk's line under the heading (`req-sub`), which this port had
          dropped. Its descriptive half is verbatim; its count clause ("N open ·")
          is NOT ported, and not faked: the only count this desk has is
          `pagination.total_count`, which is scoped to the ACTIVE FILTERS and to
          every status, so printing it as "open" would be a number that changes
          when you touch a dropdown while claiming to mean something that does
          not. The same reason the wait banner above says "on this page". */
        <>
          Every collector request, message &amp; action, organised by status so nothing is
          missed.
        </>
      }
    >
      {waiting > 0 && (
        /* The old desk's own banner (`:29406`), with its own arithmetic: how
           many of the rows ON THIS PAGE have been sitting at their kind's
           arrival status longer than the threshold. Page-scoped and said so —
           the API has no age filter, so a total across the feed would be a
           number this desk cannot actually compute. */
        <p className="ad-waitbanner" role="status">
          <strong>
            {waiting} {waiting === 1 ? 'request has' : 'requests have'} been waiting longer
            than {waitHours()}h
          </strong>{' '}
          on this page — they are still at the status they arrived in.
        </p>
      )}

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
