/**
 * AdminRequestsPage — `/admin/requests`. The unified CRM request feed: every
 * collector action (Buy now / 24h hold / Request viewing / Make an offer)
 * arrives here, filterable by kind and status, with a per-row status
 * transition. This is the "Admin receives the action" end of flow 1.
 *
 * Chrome ported from `darzstudio.art` `darz-studio.html`: `.ad-h`, `.ad-toolbar`,
 * `.ad-card` + `.ad-tbl` (see admin.css for the per-block line citations).
 *
 * Statuses come from `GET /api/options/` — never a hardcoded label lookup
 * (CLAUDE.md, "API access"). The status vocabulary depends on the kind, which
 * the options endpoint does not express; see `docs/FLOW_1_API_GAPS.md`
 * (G-F1-4).
 */
import { useEffect, useState } from 'react';
import { useApi } from '../../api/hooks';
import type { OptionsMap } from '../../api/services';
import type { AdminRequest, AdminRequestQuery } from '../../api/types';
import { Pager } from '../catalogue/Pager';
import { useListController } from '../shared/useListController';
import { AdminRequestsController } from './AdminRequestsController';
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
  const { state, setQuery, setPage, reload } = useListController<
    AdminRequest,
    AdminRequestQuery
  >(() => new AdminRequestsController(crm));
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

  const statuses = statusChoices(choices);

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

  return (
    <div className="dz-page ad-page">
      <h1 className="ad-h">Requests</h1>

      <div className="ad-toolbar">
        <select
          value={state.query.kind ?? ''}
          onChange={(e) => setQuery({ kind: e.target.value || undefined })}
          aria-label="Filter by kind"
        >
          <option value="">All kinds</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {titleCase(k)}
            </option>
          ))}
        </select>
        <select
          value={state.query.status ?? ''}
          onChange={(e) => setQuery({ status: e.target.value || undefined })}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {state.status === 'loading' && state.results.length === 0 && (
        <p className="dz-state">Loading…</p>
      )}
      {state.status === 'error' && <p className="dz-state err">{state.error}</p>}
      {actionError && <p className="dz-state err">{actionError}</p>}
      {state.status !== 'loading' &&
        state.status !== 'error' &&
        state.results.length === 0 && (
          <p className="dz-state">No requests match these filters.</p>
        )}

      {state.results.length > 0 && (
        <div className="ad-card">
          <div className="ad-scroll">
            <table className="ad-tbl">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Kind</th>
                  <th>Collector</th>
                  <th>Artwork</th>
                  <th>Detail</th>
                  <th>Status</th>
                  <th>Move to</th>
                </tr>
              </thead>
              <tbody>
                {state.results.map((r) => (
                  <tr key={r.id}>
                    <td className="ad-when">{whenLabel(r.created_at)}</td>
                    <td>
                      <span className={`ad-chip ${r.kind}`}>{titleCase(r.kind)}</span>
                    </td>
                    <td className="ad-id">{shortId(r.collector)}</td>
                    <td className="ad-id">{r.artwork ? shortId(r.artwork) : '—'}</td>
                    <td>{detailLine(r.detail)}</td>
                    <td>{titleCase(r.status)}</td>
                    <td aria-busy={busyId === r.id || undefined}>
                      <select
                        value=""
                        onChange={(e) => void transition(r.id, e.target.value)}
                        aria-label={`Move request ${shortId(r.id)} to another status`}
                      >
                        <option value="">Move to…</option>
                        {statuses
                          .filter((s) => s.value !== r.status)
                          .map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {state.pagination && <Pager pagination={state.pagination} onPage={setPage} />}
    </div>
  );
}

// --- helpers ---------------------------------------------------------------

/** `GET /api/options/` publishes choice sets keyed by `app.field`. The request
 * status set is `crm.request_status`; fall back to an empty list rather than
 * inventing labels. */
function statusChoices(map: OptionsMap | null): Array<{ value: string; label: string }> {
  if (!map) return [];
  return map['crm.request_status'] ?? map['crm.status'] ?? [];
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
