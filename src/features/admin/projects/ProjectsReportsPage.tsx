/**
 * ProjectsReportsPage — `/admin/projects/reports`, the Reports desk
 * (`DZProjects.reports` / `newChk` / `editChk` / `_chkModal` / `chkSet` /
 * `chkItems` / `saveChk` / `delChk`, `darz-studio.html:15442-15481`) over
 * `GET /projects/admin/projects/reports/`, one walk of the projects and one
 * of the checklist templates.
 *
 * Ported content:
 *  - the heading and the sub (:15461);
 *  - "Deliverables roll-up" (:15462-15463): every deliverable across active
 *    projects, soonest-due first — its text, project · owner, "blocked by:
 *    X" when its dependency is another deliverable of the same project
 *    (:15447-15449), the due chip ('no date') and the Done / Overdue / Due
 *    soon / Open pill (:15448); a row opens the project; the empty line
 *    (:15451);
 *  - "Per-project reports" (:15453-15457): every project as name · client ·
 *    stage with "Internal report" (owner only, :15455) and "Client report"
 *    (:15456) — the report route instead of the pop-up window; "No projects
 *    yet.";
 *  - "Checklist templates" (:15459, :15466): the panel, "＋ Template", each
 *    template as name · stage · N items with Edit / ✕, "No checklist
 *    templates yet.", the Delete confirm (:15481), the editor's three
 *    fields (:15473-15475), Cancel / "Save template" (:15477), "Name the
 *    template" and "Checklist template saved" (:15480).
 *
 * Mechanics that changed:
 *  - the roll-up is the server's (`reports_deliverables_rollup`: active
 *    projects only, sorted like :15444-15446, done rows included); the
 *    dependency name resolves from the same roll-up rows, since every
 *    deliverable of an active project is in it. The pill rule takes today's
 *    date (`todayIso`) in place of `Date.now()`, like `projFlag`;
 *  - the per-project list walks `GET /projects/` (`per_page: 100`, every
 *    page) in the order served (`-created_at`, newest first); the old sort
 *    by `_ts` (last updated, :15453) has no ordering key on the API;
 *  - the templates walk `GET /checklists/`; the editor is an inline block in
 *    the panel in place of the modal (:15471); Save creates, or PATCHes with
 *    `expected_version`, and a 409 is a banner with a Reload button;
 *  - stage labels come from `projects.stage` (`useOptions`), never the old
 *    `PROJ_STAGES` table; a new template's default stage stays the old
 *    'proposal' (:15469) when that key exists, else the first stage;
 *  - the `Lib.toast` lines are `.dzp-mut` status lines;
 *  - the old panel seeded four standard checklist templates on first open
 *    (`projSeedIfEmpty`, :13443-13448). That silent seeding is not ported —
 *    they arrive with the standard set, an explicit owner action on the
 *    Packages desk — so the EMPTY panel says where they come from and links
 *    there. The action itself lives in that one place; no button here.
 *
 * A template here is what a stage move seeds the stage's checklist from
 * (`projChecklistFor` / `setStage`, :13321 / :13709): the record and the board
 * both write it through `moveStages` since `stages` became writable (G-PROJ-3).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConflictError } from '../../../api/errors';
import { useApi, useOptions, useSession } from '../../../api/hooks';
import type {
  ChecklistTemplateAdmin,
  ChecklistTemplateInput,
  Choice,
  ProjectAdmin,
  ProjectReportRow,
} from '../../../api/types';
import { asAdminRole } from '../adminNav';
import { ConfirmDialog, ConflictBanner, DeskBanner, DeskPage } from '../kit';
import {
  asChecklistStrings,
  asDeliverables,
  choices,
  clientName,
  stageLabel,
  todayIso,
  walkPages,
  type Deliverable,
} from './projectForm';
import '../admin.css';

const DAY_MS = 86400000; // projDayMs(), :13285

/* ── the old desk's own inline styles, kept where it had them ───────────── */
const LABEL_FIRST = { margin: '6px 0 8px' } as const; // :15462
const LABEL_NEXT = { margin: '18px 0 8px' } as const; // :15464
const T14 = { fontSize: 14 } as const; // :15450
const T15 = { fontSize: 15 } as const; // :15454
const STATIC_ROW = { cursor: 'default' } as const; // :15454
const ACTS_TIGHT = { marginTop: 0 } as const; // :15454
const PANEL_HEAD = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '11px 0',
} as const; // :15466
const PANEL_LABEL = { margin: 0 } as const; // :15466 — the label had no margin there
const CHK_NAME = { flex: 1, fontSize: 12, color: 'var(--ink)' } as const; // :15459
const EMPTY_NEXT = { marginTop: 6 } as const; // the empty panel's second line
const EDITOR = { borderTop: '1px solid var(--hair)', padding: '12px 0 14px' } as const;
const ITEMS = { minHeight: 120 } as const; // :15475
const WARN = { color: 'var(--dzp-attn)', marginTop: 8 } as const; // the old overlap note's amber (:13831)

/** One roll-up row, its deliverable read through the guard. */
interface RollupRow {
  key: string;
  projectId: string;
  projectName: string;
  d: Deliverable;
  /** :15447-15449 — the dependency's text when it is another deliverable of
   * the same project and this one is not done; '' otherwise */
  blockedBy: string;
}

const BLANK: Deliverable = { id: '', text: '', due: '', owner: '', done: false, depId: '' };

/** :15447 `depName` over the roll-up itself. */
function rollupRows(rows: ProjectReportRow[]): RollupRow[] {
  const typed = rows.map((r) => ({ r, d: asDeliverables([r.deliverable])[0] ?? BLANK }));
  const depName = (projectId: string, depId: string): string => {
    if (!depId) return '';
    const hit = typed.find((x) => x.r.project_id === projectId && x.d.id === depId);
    return hit ? hit.d.text || 'a deliverable' : '';
  };
  return typed.map(({ r, d }, i) => {
    const dep = depName(r.project_id, d.depId);
    return {
      key: `${r.project_id}:${d.id || i}`,
      projectId: r.project_id,
      projectName: r.project_name,
      d,
      blockedBy: dep && !d.done ? dep : '',
    };
  });
}

/** :15448 — Done / Overdue / Due soon / Open, keyed on today's date. */
function rollupStatus(
  d: Deliverable,
  today: string,
): { c: 'done' | 'block' | 'attn' | 'active'; t: string } {
  if (d.done) return { c: 'done', t: 'Done' };
  const due = d.due ? Date.parse(d.due) : NaN;
  if (Number.isFinite(due)) {
    const diff = due - Date.parse(today);
    if (diff < 0) return { c: 'block', t: 'Overdue' };
    if (diff < 7 * DAY_MS) return { c: 'attn', t: 'Due soon' };
  }
  return { c: 'active', t: 'Open' };
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/** One loaded list: `null` until it arrives, or the failure. */
interface Loaded<T> {
  rows: T[] | null;
  error: string | null;
}
const PENDING = { rows: null, error: null } as const;

/** The editor's fields (`_chkDraft`, :15469). `items` stay the textarea's
 * text until Save splits them (:15479). */
interface ChkDraft {
  name: string;
  stage: string;
  itemsText: string;
}

interface Editor {
  /** null = new (:15469); an id = edit (:15470), with its version for the lock */
  id: string | null;
  version: number;
  draft: ChkDraft;
}

export function ProjectsReportsPage() {
  const { projectsAdmin } = useApi();
  const options = useOptions();
  const { me } = useSession();
  const canMoney = asAdminRole(me?.role) === 'owner'; // projCanMoney(), :15443

  const stages = choices(options, 'projects.stage');
  const today = todayIso();

  const [rollup, setRollup] = useState<Loaded<ProjectReportRow>>(PENDING);
  const [projects, setProjects] = useState<Loaded<ProjectAdmin>>(PENDING);
  const [chks, setChks] = useState<Loaded<ChecklistTemplateAdmin>>(PENDING);

  // promise chains (the `useOptions` shape): state is set in the settle
  // callbacks, never synchronously inside the effect
  useEffect(() => {
    let alive = true;
    projectsAdmin.reports().then(
      (res) => alive && setRollup({ rows: res.deliverables, error: null }),
      (err: unknown) =>
        alive &&
        setRollup({ rows: null, error: errorText(err, 'Could not load the roll-up.') }),
    );
    walkPages((page) => projectsAdmin.projects({ page, per_page: 100 })).then(
      (rows) => alive && setProjects({ rows, error: null }),
      (err: unknown) =>
        alive &&
        setProjects({ rows: null, error: errorText(err, 'Could not load the projects.') }),
    );
    return () => {
      alive = false;
    };
  }, [projectsAdmin]);

  const loadChecklists = useCallback(
    () =>
      walkPages((page) => projectsAdmin.checklists({ page, per_page: 100 })).then(
        (rows) => setChks({ rows, error: null }),
        (err: unknown) =>
          setChks({ rows: null, error: errorText(err, 'Could not load the templates.') }),
      ),
    [projectsAdmin],
  );
  useEffect(() => {
    void loadChecklists();
  }, [loadChecklists]);

  const [editor, setEditor] = useState<Editor | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<ChecklistTemplateAdmin | null>(null);

  const open = (next: Editor) => {
    setFormError(null);
    setNote(null);
    setEditor(next);
  };
  // :15469 — `stage:'proposal'`; the key must exist in this backend's stages
  const newChk = () =>
    open({
      id: null,
      version: 0,
      draft: {
        name: '',
        stage: stages.some((s) => s.value === 'proposal')
          ? 'proposal'
          : (stages[0]?.value ?? ''),
        itemsText: '',
      },
    });
  // :15470, :15475 — `(d.items||[]).join('\n')`
  const editChk = (c: ChecklistTemplateAdmin) =>
    open({
      id: c.id,
      version: c.version,
      draft: {
        name: c.name,
        stage: c.stage ?? '',
        itemsText: asChecklistStrings(c.items).join('\n'),
      },
    });
  const chkSet = (patch: Partial<ChkDraft>) =>
    setEditor((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e)); // :15478

  /** `saveChk` (:15480). */
  const saveChk = async () => {
    if (!editor || busy) return;
    const d = editor.draft;
    if (!d.name.trim()) {
      setFormError('Name the template');
      return;
    }
    setFormError(null);
    setActionError(null);
    setConflict(false);
    setBusy(true);
    const body: ChecklistTemplateInput = {
      name: d.name.trim(),
      stage: d.stage,
      items: asChecklistStrings(d.itemsText.split(/\n+/)), // `chkItems`, :15479
    };
    try {
      if (editor.id)
        await projectsAdmin.updateChecklist(editor.id, {
          ...body,
          expected_version: editor.version,
        });
      else await projectsAdmin.createChecklist(body);
      setEditor(null);
      setNote('Checklist template saved');
      await loadChecklists();
    } catch (err: unknown) {
      if (err instanceof ConflictError) setConflict(true);
      else setActionError(errorText(err, 'Could not save the template.'));
    } finally {
      setBusy(false);
    }
  };

  /** `delChk` (:15481), after the confirm. */
  const delChk = async (c: ChecklistTemplateAdmin) => {
    setActionError(null);
    setNote(null);
    try {
      await projectsAdmin.deleteChecklist(c.id);
      if (editor?.id === c.id) setEditor(null);
      await loadChecklists();
    } catch (err: unknown) {
      setActionError(errorText(err, 'Could not delete the template.'));
    }
  };

  const reloadAll = () => {
    setConflict(false);
    setActionError(null);
    setEditor(null);
    void loadChecklists();
  };

  const rows = rollup.rows ? rollupRows(rollup.rows) : [];

  return (
    <DeskPage
      title="Reports"
      subtitle={
        /* :15461 */
        <>
          Every deliverable across active projects — owner, due, status and what’s blocked —
          plus per-project reports and reusable checklist templates. Client reports omit
          internal cost, margin and notes.
        </>
      }
    >
      <div className="dzp">
        {conflict && (
          <ConflictBanner noun="template" onReload={reloadAll} reloadClassName="dzp-btn sm" />
        )}
        {actionError && <DeskBanner>{actionError}</DeskBanner>}
        {note && (
          <p className="dzp-mut" role="status">
            {note}
          </p>
        )}

        {/* :15462-15463 */}
        <div className="dzp-fl" style={LABEL_FIRST}>
          Deliverables roll-up
        </div>
        {rollup.error && <DeskBanner>{rollup.error}</DeskBanner>}
        {rollup.rows === null && !rollup.error && <p className="dz-state">Loading…</p>}
        {rollup.rows !== null && (
          <div className="dzp-list">
            {rows.length ? (
              rows.map((row) => <RollupLine key={row.key} row={row} today={today} />)
            ) : (
              // :15451
              <div className="dzp-empty">No deliverables across active projects yet.</div>
            )}
          </div>
        )}

        {/* :15464-15465 */}
        <div className="dzp-fl" style={LABEL_NEXT}>
          Per-project reports
        </div>
        {projects.error && <DeskBanner>{projects.error}</DeskBanner>}
        {projects.rows === null && !projects.error && <p className="dz-state">Loading…</p>}
        {projects.rows !== null && (
          <div className="dzp-list">
            {projects.rows.length ? (
              projects.rows.map((p) => (
                <ProjectLine key={p.id} p={p} stages={stages} canMoney={canMoney} />
              ))
            ) : (
              // :15457
              <div className="dzp-empty">No projects yet.</div>
            )}
          </div>
        )}

        {/* :15466 */}
        <div className="dzp-panel">
          <div style={PANEL_HEAD}>
            <div className="dzp-fl" style={PANEL_LABEL}>
              Checklist templates
            </div>
            <button type="button" className="dzp-btn sm" onClick={newChk} disabled={busy}>
              ＋ Template
            </button>
          </div>

          {editor && (
            <ChecklistEditor
              title={editor.id ? 'Edit checklist template' : 'New checklist template'}
              draft={editor.draft}
              stages={stages}
              error={formError}
              busy={busy}
              onChange={chkSet}
              onCancel={() => setEditor(null)}
              onSave={() => void saveChk()}
            />
          )}

          {chks.error && <DeskBanner>{chks.error}</DeskBanner>}
          {chks.rows === null && !chks.error && <p className="dz-state">Loading…</p>}
          {chks.rows !== null &&
            (chks.rows.length ? (
              chks.rows.map((c) => (
                // :15459
                <div className="dzp-line" key={c.id}>
                  <span style={CHK_NAME}>
                    {c.name || 'Checklist'}{' '}
                    <span className="dzp-mut">
                      · {stageLabel(stages, c.stage)} · {asChecklistStrings(c.items).length}{' '}
                      items
                    </span>
                  </span>
                  <button
                    type="button"
                    className="dzp-btn sm gho"
                    onClick={() => editChk(c)}
                    disabled={busy}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="dzp-btn sm gho dgr"
                    onClick={() => setRemoving(c)}
                    disabled={busy}
                    aria-label={`Delete ${c.name || 'checklist'}`}
                  >
                    ✕
                  </button>
                </div>
              ))
            ) : (
              <>
                <div className="dzp-mut">No checklist templates yet.</div>
                {/* where the old panel's four came from: `projSeedIfEmpty`
                    wrote Proposal checklist · Shoot-day checklist ·
                    Publication checklist · Archive handoff on first open
                    (:13443-13448). That seeding is not ported — the four
                    arrive with the standard set, an explicit owner action
                    on the Packages desk. One place only; no button here. */}
                <div className="dzp-mut" style={EMPTY_NEXT}>
                  The old panel’s four standard templates arrive with the standard set under{' '}
                  <Link to="/admin/projects/packages?catalogue=1">
                    Packages › Service catalogue
                  </Link>{' '}
                  — the owner adds them there.
                </div>
              </>
            ))}
        </div>
      </div>

      {removing && (
        // :15481
        <ConfirmDialog
          message="Delete this checklist template?"
          okLabel="Delete"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const c = removing;
            setRemoving(null);
            void delChk(c);
          }}
        />
      )}
    </DeskPage>
  );
}

/** One roll-up row (:15450) — the whole row opens the project. */
function RollupLine({ row, today }: { row: RollupRow; today: string }) {
  const { d } = row;
  const st = rollupStatus(d, today);
  return (
    <Link className="dzp-row" to={`/admin/projects/${row.projectId}`}>
      <div className="dzp-who">
        <div className="t" style={T14}>
          {d.text || 'Deliverable'}
        </div>
        <div className="a">
          {row.projectName}
          {d.owner ? ` · ${d.owner}` : ''}
        </div>
        {row.blockedBy && <div className="dzp-mut">blocked by: {row.blockedBy}</div>}
      </div>
      <div className="dzp-mid">
        <span className="dzp-chip">{d.due || 'no date'}</span>
      </div>
      <div className="dzp-end">
        <span className={`dzp-pill ${st.c}`}>{st.t}</span>
      </div>
    </Link>
  );
}

/** One per-project row (:15454-15456) — no click on the row; the two
 * report buttons are the actions. */
function ProjectLine({
  p,
  stages,
  canMoney,
}: {
  p: ProjectAdmin;
  stages: Choice[];
  canMoney: boolean;
}) {
  return (
    <div className="dzp-row" style={STATIC_ROW}>
      <div className="dzp-who">
        <div className="t" style={T15}>
          {p.name || p.no}
        </div>
        <div className="a">
          {clientName(p) || 'No client'} · {stageLabel(stages, p.stage)}
        </div>
      </div>
      <div className="dzp-end">
        <div className="dzp-acts" style={ACTS_TIGHT}>
          {canMoney && (
            // :15455
            <Link className="dzp-btn sm" to={`/admin/projects/${p.id}/report`}>
              Internal report
            </Link>
          )}
          {/* :15456 */}
          <Link className="dzp-btn sm pri" to={`/admin/projects/${p.id}/report?client=1`}>
            Client report
          </Link>
        </div>
      </div>
    </div>
  );
}

/** `_chkModal` (:15471-15477) as an inline block of the panel: the same
 * three fields, the same two buttons. The modal head's eyebrow "Reports" +
 * title take the desk's section heading recipe. */
function ChecklistEditor({
  title,
  draft,
  stages,
  error,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  title: string;
  draft: ChkDraft;
  stages: Choice[];
  error: string | null;
  busy: boolean;
  onChange: (patch: Partial<ChkDraft>) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div style={EDITOR}>
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">{title}</h2>
        <span className="ad-dsec-n">Reports</span>
      </div>
      <div className="dzp-form">
        {/* :15473 */}
        <label className="full">
          <span className="fl">Template name</span>
          <input value={draft.name} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        {/* :15474 — `projStageOpts`, from the backend's stages */}
        <label className="full">
          <span className="fl">Stage</span>
          <select value={draft.stage} onChange={(e) => onChange({ stage: e.target.value })}>
            {stages.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        {/* :15475 */}
        <label className="full">
          <span className="fl">Items (one per line)</span>
          <textarea
            className="dzp-ta"
            style={ITEMS}
            value={draft.itemsText}
            onChange={(e) => onChange({ itemsText: e.target.value })}
          />
        </label>
      </div>
      {error && (
        // :15480 — the old toast
        <p className="dzp-mut" role="alert" style={WARN}>
          {error}
        </p>
      )}
      {/* :15477 */}
      <div className="dzp-acts">
        <button type="button" className="dzp-btn gho" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="dzp-btn pri" onClick={onSave} disabled={busy}>
          Save template
        </button>
      </div>
    </div>
  );
}
