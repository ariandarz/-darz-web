/**
 * Team workflow & performance (`_teamTabHTML`, `darz-studio.html:19317-19357`)
 * over `/workspace/team-tasks/` (+ `log-time/`, `performance/`) — the one
 * workspace tab a standard admin sees (`IsStandardAdminOrOwner`, G-TEAM-1 W2).
 *
 * Ported as the old desk draws it: three tiles, the Pricelist approvals box,
 * the assign row, the task list (status dot, title in place, the time logged
 * with its `+15m`, owner / status selects, due pill, delete), then the two
 * tables.
 *
 * What changed with a server behind it:
 *  - time is append-only — `+15m` posts `{minutes: 15}` to `log-time/` and the
 *    row shows the server's `minutes_logged`; nothing edits that number;
 *  - an owner is a TeamUser uuid, not a name. The choices are the admin
 *    accounts the performance report lists (`behaviour`), because the team
 *    roster itself (`/auth/admin/team-users/`) is owner-only and a standard
 *    admin must be able to assign too;
 *  - both tables come from `performance/`, so "Admin behaviour" now shows real
 *    sign-in counts (`TeamLoginEvent`) and is re-read after every task write.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi, useOptions } from '../../../api/hooks';
import type {
  Choice,
  PricelistApproval,
  TeamPerformance,
  TeamTask,
  TeamTaskPatch,
  TeamTaskStatus,
} from '../../../api/types';
import { cx } from '../../../lib/cx';
import { useListController } from '../../shared/useListController';
import { ConfirmDialog, ConflictBanner, DeskBanner, deskBanner } from '../kit';
import { choices } from '../saleForm';
import { TeamTasksController } from './controllers';
import { ChoiceSelect, DuePill, InlineText } from './fields';
import { PricelistApprovals } from './PricelistApprovals';
import { useRowWrites } from './useRowWrites';
import { fmtMinutes, startOfToday, taskOrder, teamTiles } from './workspace';

/** The owner select's first option (`['Unassigned'].concat(ppl)`, `:19322`). */
const UNASSIGNED: Choice = { value: '', label: 'Unassigned' };

export function TeamWorkflowTab({
  refreshKey,
  approvals,
  say,
}: {
  refreshKey: number;
  approvals: {
    rows: readonly PricelistApproval[];
    loading: boolean;
    error: string | null;
    reload: () => void;
  };
  say: (message: string) => void;
}) {
  const { workspace } = useApi();
  const options = useOptions();
  const statuses = choices(options, 'workspace.team_task_status');

  const [ctrl] = useState(() => new TeamTasksController(workspace));
  const { state, reload } = useListController(() => ctrl);
  const writes = useRowWrites();

  const [perf, setPerf] = useState<TeamPerformance | null>(null);
  const [perfError, setPerfError] = useState<string | null>(null);
  const loadPerf = useCallback(() => {
    workspace.teamPerformance().then(
      (p) => {
        setPerf(p);
        setPerfError(null);
      },
      (err: unknown) =>
        setPerfError(
          err instanceof Error ? err.message : 'Could not load the performance tables.',
        ),
    );
  }, [workspace]);
  useEffect(loadPerf, [loadPerf]);

  const lastKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey === lastKey.current) return;
    lastKey.current = refreshKey;
    void ctrl.reload();
    loadPerf();
  }, [refreshKey, ctrl, loadPerf]);

  const [newTitle, setNewTitle] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<TeamTask | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const today = startOfToday();
  const tasks = taskOrder(state.results);
  const tiles = teamTiles(state.results);

  // The people a task can go to: every admin account the report lists, plus
  // any current assignee it no longer does (a deactivated login), so a row
  // never shows the wrong name.
  const people: Choice[] = (perf?.behaviour ?? []).map((b) => ({
    value: b.team_user_id,
    label: b.name || '—',
  }));
  for (const t of state.results) {
    if (t.assignee && !people.some((p) => p.value === t.assignee!.id)) {
      people.push({ value: t.assignee.id, label: t.assignee.name || '—' });
    }
  }

  const current = (id: string) => ctrl.getSnapshot().results.find((r) => r.id === id);

  const patch = async (id: string, body: Omit<TeamTaskPatch, 'expected_version'>) => {
    const row = current(id);
    if (!row) return;
    const saved = await writes.run(() =>
      workspace.updateTeamTask(id, { ...body, expected_version: row.version }),
    );
    if (saved) {
      ctrl.put(saved);
      loadPerf();
    }
  };

  const logQuarter = async (id: string) => {
    setBusyId(id);
    const saved = await writes.run(() => workspace.logTime(id, 15));
    setBusyId(null);
    if (saved) {
      ctrl.put(saved);
      loadPerf();
    }
  };

  const add = async () => {
    const title = newTitle.trim();
    if (!title) {
      say('Enter a task');
      return;
    }
    if (adding) return;
    setAdding(true);
    const saved = await writes.run(() =>
      workspace.createTeamTask({ title, assignee: newOwner || null }),
    );
    setAdding(false);
    if (saved) {
      ctrl.put(saved);
      setNewTitle('');
      setNewOwner(''); // the old re-render put the select back on Unassigned
      loadPerf();
    }
  };

  const remove = async (task: TeamTask) => {
    const ok = await writes.run(() => workspace.deleteTeamTask(task.id).then(() => true));
    if (ok) {
      ctrl.drop(task.id);
      loadPerf();
    }
  };

  // `_wsStat(n, label, '')` — no filter behind these, so not a control
  const tile = (n: number | string, text: string, accent?: string) => (
    <div className={cx('ws-stat is-static', accent)}>
      <div className="ws-stat-n">{n}</div>
      <div className="ws-stat-l">{text}</div>
    </div>
  );

  const banner = deskBanner(state.status, state.error, writes.error);

  return (
    <>
      <div className="ws-stats is-3">
        {tile(tiles.open, 'Open tasks')}
        {tile(tiles.done, 'Done', 'good')}
        {tile(fmtMinutes(tiles.minutes), 'Time logged')}
      </div>

      <PricelistApprovals
        rows={approvals.rows}
        loading={approvals.loading}
        error={approvals.error}
        onChanged={approvals.reload}
        say={say}
      />

      <div className="ws-add is-spaced">
        <input
          className="ws-addinput"
          placeholder="Assign a team task — press Enter"
          aria-label="New team task"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add();
          }}
        />
        <ChoiceSelect
          className="ws-sel is-lg"
          label="Assign to"
          value={newOwner}
          leading={UNASSIGNED}
          choices={people}
          onChange={setNewOwner}
        />
        <button
          type="button"
          className="ws-addbtn"
          disabled={adding}
          onClick={() => void add()}
        >
          Add task
        </button>
      </div>

      {writes.conflict && (
        <ConflictBanner
          noun="task"
          onReload={() => {
            writes.clear();
            void reload();
            loadPerf();
          }}
        />
      )}
      {banner && <DeskBanner>{banner}</DeskBanner>}

      {state.status === 'loading' && tasks.length === 0 ? (
        <p className="dz-state">Loading…</p>
      ) : tasks.length > 0 ? (
        <div className="ws-list">
          {tasks.map((t) => {
            const status: TeamTaskStatus = t.status ?? 'todo';
            return (
              <div
                className={cx('ws-item', status === 'done' && 'is-done')}
                key={t.id}
                aria-busy={busyId === t.id || undefined}
              >
                <span className={`ws-kdot s-${status}`} />
                <div className="ws-body">
                  <InlineText
                    key={`t${t.version}`}
                    className="ws-title"
                    label="Task"
                    placeholder="Task"
                    value={t.title ?? ''}
                    onCommit={(title) => void patch(t.id, { title })}
                  />
                  <div className="ws-sub ws-time">
                    <span className="ws-time-n">{fmtMinutes(t.minutes_logged)}</span>
                    <button
                      type="button"
                      className="ws-due is-log"
                      title="Add 15 minutes"
                      disabled={busyId === t.id}
                      onClick={() => void logQuarter(t.id)}
                    >
                      +15m
                    </button>
                  </div>
                </div>
                <div className="ws-meta">
                  <ChoiceSelect
                    label="Owner"
                    value={t.assignee?.id ?? ''}
                    leading={UNASSIGNED}
                    choices={people}
                    onChange={(v) => void patch(t.id, { assignee: v || null })}
                  />
                  <ChoiceSelect
                    className={`ws-sel s-${status}`}
                    label="Status"
                    value={status}
                    choices={statuses}
                    onChange={(v) => void patch(t.id, { status: v as TeamTaskStatus })}
                  />
                  <DuePill
                    date={t.due_date}
                    placeholder="Due"
                    label="Due date"
                    today={today}
                    onChange={(due_date) => void patch(t.id, { due_date })}
                  />
                </div>
                <button
                  type="button"
                  className="ws-x"
                  title="Delete"
                  aria-label="Delete"
                  onClick={() => setDeleting(t)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ws-empty">No team tasks yet — assign one above.</div>
      )}

      {perfError && <DeskBanner>{perfError}</DeskBanner>}

      <div className="ws-sectlbl">Performance by person</div>
      <div className="ad-card ad-scroll">
        <table className="ad-tbl" aria-label="Performance by person">
          <thead>
            <tr>
              <th>Person</th>
              <th className="is-c">Open</th>
              <th className="is-c">Done</th>
              <th className="is-c">Done · 7d</th>
              <th className="is-c">Time</th>
            </tr>
          </thead>
          <tbody>
            {perf && perf.performance.length > 0 ? (
              perf.performance.map((r) => (
                <tr key={r.team_user_id ?? 'unassigned'}>
                  <td className="is-name">{r.name}</td>
                  <td className="is-c">{r.open}</td>
                  <td className="is-c">{r.done}</td>
                  <td className="is-c is-good">{r.done_last_7d}</td>
                  <td className="is-c is-mono">{fmtMinutes(r.minutes_logged)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="ad-empty">
                  {perf ? 'No tasks yet.' : 'Loading…'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="ws-sectlbl">Admin behaviour</div>
      <div className="ad-card ad-scroll">
        <table className="ad-tbl" aria-label="Admin behaviour">
          <thead>
            <tr>
              <th>Admin</th>
              <th className="is-c">Total logins</th>
              <th>Last login</th>
              <th className="is-c">Tasks done</th>
            </tr>
          </thead>
          <tbody>
            {perf && perf.behaviour.length > 0 ? (
              perf.behaviour.map((r) => (
                <tr key={r.team_user_id}>
                  <td className="is-name">{r.name || '—'}</td>
                  <td className="is-c">{r.total_logins}</td>
                  <td className="is-when">
                    {r.last_login ? new Date(r.last_login).toLocaleString() : '—'}
                  </td>
                  <td className="is-c">{r.tasks_done}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="ad-empty">
                  {perf ? 'No admins yet.' : 'Loading…'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {deleting && (
        <ConfirmDialog
          message="Delete this task?"
          okLabel="Delete"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const t = deleting;
            setDeleting(null);
            void remove(t);
          }}
        />
      )}
    </>
  );
}
