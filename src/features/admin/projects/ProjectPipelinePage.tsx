/**
 * ProjectPipelinePage — `/admin/projects/pipeline`, the 17-stage kanban
 * (`DZProjects.pipeline` / `pipeSearch` / `toggleArchPipe` / `kmove` /
 * `setStage`, `darz-studio.html:13681-13719`) over
 * `GET /projects/admin/projects/` and `POST …/projects/{id}/stage/`.
 *
 * Ported content:
 *  - the heading, the sub (:13695) and "＋ New project" (:13696 — the
 *    `/admin/projects/new` route instead of the modal);
 *  - the toolbar (:13697): "Search the board…" and the Archived toggle;
 *  - the board (:13685-13693): one column per stage in the order
 *    `projects.stage` lists them (that order IS the pipeline), each head
 *    with its label and count; one card per project — name, client, the
 *    Overdue / Due soon pill from `projFlag` (:13689) and the ‹ Back /
 *    Fwd › movers (:13690); "—" in an empty column (:13691); the empty
 *    board sentence (:13698);
 *  - `kmove` (:13704): one step either way, clamped at both ends;
 *  - the scope gate (:13707-13708): a curatorial / mixed project cannot
 *    enter Research or Production before Scope Approval, Contract and
 *    Deposit — the reason shown in a `.dzp-gate` banner whose button keeps
 *    the old label, "Got it" (`dzConfirm(reason, {okLabel: 'Got it'})`);
 *  - the "Stage → {label}" confirmation (:13718) as an inline status note.
 *
 * Mechanics that changed:
 *  - the board reads EVERY project of the toggled archive state in one
 *    walk (`archived`, `per_page: 100`, `has_next` followed): the API has
 *    no board endpoint and no server-side partner / quick filters
 *    (G-PROJ-1), and a paged kanban would hide columns. The search
 *    (:13684 — no · name · client · city) filters that set client-side,
 *    per keystroke (the old 170 ms debounce, :13702, is not ported).
 *  - a move is ONLY `POST …/stage/ {stage, expected_version}`. The old
 *    `setStage` also dated the target stage's start, seeded its checklist
 *    from the template and stamped `doneTs` on every earlier stage
 *    (:13709-13714); the API does not accept the `stages` sub-state
 *    (G-PROJ-3), so none of that happens — the page says so under the
 *    board. The status label is re-derived server-side (`STAGE_STATUS_MAP`).
 *  - the scope gate keys on stage ORDER, not `stages[k].doneTs`
 *    (`scopeGate`, projectForm.ts — the same G-PROJ-3 reason).
 *  - a 409 on the move (someone else saved the project) is a banner with
 *    a Reload button that re-reads the board.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ConflictError } from '../../../api/errors';
import { useApi, useOptions } from '../../../api/hooks';
import type { Choice, ProjectAdmin, ProjectStage } from '../../../api/types';
import {
  ConflictBanner,
  DeskAction,
  DeskBanner,
  DeskPage,
  SearchFilter,
  ToggleFilter,
} from '../kit';
import {
  choices,
  clientName,
  projFlag,
  scopeGate,
  stageIndex,
  stageLabel,
  todayIso,
  walkProjects,
  type ProjFlag,
} from './projectForm';
import '../admin.css';

/** The board's search haystack (:13684): no · name · client · city. */
function hay(p: ProjectAdmin): string {
  return [p.no, p.name, clientName(p), p.city].join(' ').toLowerCase();
}

interface Walk {
  /** which fetch these rows belong to — a different key reads as loading */
  key: string;
  rows: ProjectAdmin[] | null;
  error: string | null;
}

export function ProjectPipelinePage() {
  const { projectsAdmin } = useApi();
  const options = useOptions();
  const navigate = useNavigate();
  const stages = choices(options, 'projects.stage');
  const today = todayIso();

  // the old PROJV.pipeQ / PROJV.arch (:13682-13684, :13702-13703)
  const [q, setQ] = useState<string | undefined>(undefined);
  const [archived, setArchived] = useState(false);
  const [reloads, setReloads] = useState(0);
  const walkKey = `${archived ? 'archived' : 'live'}:${reloads}`;
  const [walk, setWalk] = useState<Walk>({ key: '', rows: null, error: null });

  useEffect(() => {
    let alive = true;
    walkProjects(projectsAdmin, archived).then(
      (rows) => alive && setWalk({ key: walkKey, rows, error: null }),
      (err: unknown) =>
        alive &&
        setWalk({
          key: walkKey,
          rows: null,
          error: err instanceof Error ? err.message : 'Could not load the board.',
        }),
    );
    return () => {
      alive = false;
    };
  }, [projectsAdmin, archived, walkKey]);

  // a walk for another key is stale — the board is loading again
  const current = walk.key === walkKey ? walk : null;
  const all = current?.rows ?? null;

  const [gate, setGate] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // :13684 — the search narrows the cards, never the columns
  const rows = useMemo(() => {
    if (!all) return [];
    const needle = (q ?? '').toLowerCase();
    return needle ? all.filter((p) => hay(p).includes(needle)) : all;
  }, [all, q]);

  /** `kmove` (:13704) + the board half of `setStage` (:13706-13718). */
  const kmove = async (p: ProjectAdmin, dir: -1 | 1) => {
    if (busyId) return;
    const i = stageIndex(stages, p.stage);
    if (i < 0) return;
    const ni = Math.max(0, Math.min(stages.length - 1, i + dir));
    if (ni === i) return;
    const target = stages[ni].value;
    if (p.stage === target) return;
    const g = scopeGate(p, target, stages); // :13707
    if (!g.ok) {
      setGate(g.reason); // :13708 — dzConfirm(reason, {okLabel: 'Got it'})
      return;
    }
    setGate(null);
    setNote(null);
    setActionError(null);
    setConflict(false);
    setBusyId(p.id);
    try {
      // the stage choices ARE the backend's StageEnum values
      const next = await projectsAdmin.setStage(p.id, target as ProjectStage, p.version);
      setWalk((w) =>
        w.rows ? { ...w, rows: w.rows.map((x) => (x.id === next.id ? next : x)) } : w,
      );
      setNote(`Stage → ${stageLabel(stages, target)}`); // :13718
    } catch (err: unknown) {
      if (err instanceof ConflictError) setConflict(true);
      else setActionError(err instanceof Error ? err.message : 'Could not move the project.');
    } finally {
      setBusyId(null);
    }
  };

  const reloadBoard = () => {
    setConflict(false);
    setActionError(null);
    setNote(null);
    setReloads((n) => n + 1);
  };

  const optionsFailed = options !== null && stages.length === 0;
  const ready = all !== null && stages.length > 0;

  return (
    <DeskPage
      wide
      title="Pipeline"
      action={
        // :13696
        <DeskAction onClick={() => navigate('/admin/projects/new')}>＋ New project</DeskAction>
      }
      toolbar={
        <>
          {/* :13697 */}
          <SearchFilter
            label="Search"
            value={q}
            onChange={setQ}
            placeholder="Search the board…"
          />
          <ToggleFilter label="Archived" checked={archived} onChange={setArchived} />
        </>
      }
    >
      {/* :13695 */}
      <p className="ad-desksub">
        The 17 stages, left to right. Move a project with Back / Fwd — curatorial work is
        blocked from Research and Production until Scope Approval, Contract and Deposit are
        recorded. Swipe the board sideways on a phone.
      </p>

      <div className="dzp">
        {conflict && (
          <ConflictBanner noun="project" onReload={reloadBoard} reloadClassName="dzp-btn sm" />
        )}
        {actionError && <DeskBanner>{actionError}</DeskBanner>}
        {current?.error && <DeskBanner>{current.error}</DeskBanner>}
        {optionsFailed && (
          <DeskBanner>
            The stage list did not load — the board cannot be drawn without it.
          </DeskBanner>
        )}

        {gate && (
          // :13708 — the gate's reason, as a banner instead of a confirm
          <div className="dzp-gate" role="alert" style={{ marginTop: 0, marginBottom: 12 }}>
            {gate}{' '}
            <button type="button" className="dzp-btn sm gho" onClick={() => setGate(null)}>
              Got it
            </button>
          </div>
        )}
        {note && (
          <p className="dzp-mut" role="status">
            {note}
          </p>
        )}

        {!ready && !current?.error && !optionsFailed && <p className="dz-state">Loading…</p>}

        {/* :13698 — the empty sentence reads the archive-filtered set, before the search */}
        {ready && all.length === 0 && (
          <div className="dzp-empty">No projects on the board yet.</div>
        )}

        {ready && all.length > 0 && (
          <div className="dzp-kan">
            {stages.map((s) => (
              <BoardColumn
                key={s.value}
                stage={s}
                items={rows.filter((p) => p.stage === s.value)}
                stages={stages}
                today={today}
                busyId={busyId}
                onMove={kmove}
              />
            ))}
          </div>
        )}

        {/* stated absence — G-PROJ-3: the old move also seeded the stage sub-state */}
        <p className="dzp-mut" role="note">
          A move records the new stage only. The old board also dated the stage’s start, seeded
          its checklist from the template and marked every earlier stage done — that stage
          sub-state is not writable on this API yet (G-PROJ-3).
        </p>
      </div>
    </DeskPage>
  );
}

/** One `.dzp-kcol` (:13687-13692): the head, the cards, or "—". */
function BoardColumn({
  stage,
  items,
  stages,
  today,
  busyId,
  onMove,
}: {
  stage: Choice;
  items: ProjectAdmin[];
  stages: Choice[];
  today: string;
  busyId: string | null;
  onMove: (p: ProjectAdmin, dir: -1 | 1) => void;
}) {
  return (
    <div className="dzp-kcol">
      <div className="dzp-kh">
        <span className="nm">{stage.label}</span>
        <span className="ct">{items.length}</span>
      </div>
      {items.length ? (
        items.map((p) => (
          <BoardCard
            key={p.id}
            p={p}
            flag={projFlag(p, stages, today)}
            busy={busyId === p.id}
            onMove={(dir) => onMove(p, dir)}
          />
        ))
      ) : (
        <div className="dzp-kmore">—</div>
      )}
    </div>
  );
}

/** One `.dzp-kcard` (:13688-13690). The card opens the record like the old
 * `onclick="openProject"`; the title is a real link so the keyboard reaches
 * it, and the movers stop the click from opening the record (:13690). */
function BoardCard({
  p,
  flag,
  busy,
  onMove,
}: {
  p: ProjectAdmin;
  flag: ProjFlag;
  busy: boolean;
  onMove: (dir: -1 | 1) => void;
}) {
  const navigate = useNavigate();
  const url = `/admin/projects/${p.id}`;
  const tone = flag.c === 'block' ? ' block' : flag.c === 'attn' ? ' attn' : '';
  return (
    <div
      className={`dzp-kcard${tone}`}
      onClick={() => navigate(url)}
      aria-busy={busy || undefined}
    >
      <div className="kt">
        <Link to={url} onClick={(e) => e.stopPropagation()}>
          {p.name || 'Untitled project'}
        </Link>
      </div>
      <div className="ka">{clientName(p) || 'No client'}</div>
      {(flag.c === 'block' || flag.c === 'attn') && (
        // :13689 — the pill and its wrapper carried these inline styles
        <div style={{ marginTop: 6 }}>
          <span className={`dzp-pill ${flag.c}`} style={{ fontSize: 9, padding: '3px 7px' }}>
            {flag.t}
          </span>
        </div>
      )}
      <div className="dzp-kmove">
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onMove(-1);
          }}
        >
          ‹ Back
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onMove(1);
          }}
        >
          Fwd ›
        </button>
      </div>
    </div>
  );
}
