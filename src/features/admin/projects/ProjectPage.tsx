/**
 * ProjectPage — `/admin/projects/:id`, the project record. The old panel's
 * detail modal (`DZProjects.openProject` → `_reRenderDetail` → `_detail`,
 * `darz-studio.html:13756-13869`) as a route, with `_sec` (:13870), the
 * working-copy setters (:13874-13891), `saveProject` / `archiveProject` /
 * `delProject` (:13893-13896), the rail click `setStage` (:13706-13719) and
 * the per-project partner lanes (:13823-13849, :15437-15439).
 *
 * Ported as it was: the header (no · category eyebrow, name, client chip +
 * flag pill), the stage rail, the nine collapsible sections in their order
 * and default-open state, every field label, placeholder, empty state,
 * button label and toast line, the Delete confirm, and the money / internal
 * notes gate (`projCanMoney()` = owner, :13282 → the owner role).
 *
 * Mechanics that changed (each stated on screen where it shows):
 *  - the working copy (`_projDraft`) is React state; Save sends ONE `PATCH`
 *    with every editable field + `expected_version` and adopts the response
 *    (the old `projPut(_projDraft)` wrote the record to localStorage);
 *  - a stage move is `POST …/stage/` alone — the old seeding of the stage
 *    sub-state (:13709-13714: start date, checklist, doneTs) has no API
 *    (G-PROJ-3); unsaved edits are saved FIRST because the move adopts the
 *    server's record; the scope gate reads the draft's category, i.e. what
 *    that save writes;
 *  - Status is read-only text ("derived from the stage") — not writable on
 *    the API (G-PROJ-2), so the old `<select>` at :13781 is gone;
 *  - attachments are server files (`…/attachments/`), not localStorage
 *    slots (:13889-13891): the heading drops "(kept on this device)", Open
 *    is the file's URL, ✕ deletes on the server at once (the old removed
 *    the slot at once too) — the attachment list is NOT part of the draft;
 *  - Archive / Save / stage moves stay on the page with a status line (the
 *    old closed the modal and toasted); Archive carries the draft along in
 *    the same PATCH so unsaved edits are not lost; Cancel and Delete go to
 *    the list;
 *  - `dzConfirm(reason, {okLabel:'Got it'})` for a blocked move (:13708) is
 *    the `.dzp-gate` panel, its button keeping the old word; `dzConfirm` for Delete is
 *    `ConfirmDialog`; the Proposal section issues a `documents.Document`
 *    (ProjectProposal.tsx) instead of opening the old composer (:14049);
 *  - the report buttons of the old Reports desk (:15455-15456) also sit under
 *    the header here, since the report is a route of this record now;
 *  - a partner org the Partners desk soft-deleted stays on the record (its
 *    confirm promises "Projects keep their recorded roles") but the update
 *    serializer rejects its id (`PrimaryKeyRelatedField(is_deleted=False)`,
 *    serializers.py:104-110, while the read serializer still returns it —
 *    an API gap): the two org links are therefore send-on-change, a changed
 *    lane set carries only orgs the page could load, and such a lane / client
 *    is named from the record's own `partner_orgs` mirror with a note;
 *  - the record is keyed on the route id (as PackageEditorPage), so one id →
 *    another remounts with fresh state and a late response cannot land on
 *    the wrong record; the inputs are disabled while a write is in flight
 *    (the adopt would drop keystrokes typed meanwhile); Cancel goes back to
 *    where the record was opened from (`_close`, :13761), the list when
 *    there is nowhere to go back to.
 * Not ported: `venueEventId` / `_ts` / `updatedBy` bookkeeping (no fields),
 * the list / pipeline / dashboard re-render after save (routes now). A lane
 * without a partner org cannot be saved (the wire dict is keyed by org) —
 * said under the lanes when it applies.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ConflictError, ValidationError } from '../../../api/errors';
import { useApi, useOptions, useSession } from '../../../api/hooks';
import type {
  Choice,
  Paginated,
  PartnerOrgAdmin,
  ProjectAdmin,
  ProjectAttachmentAdmin,
  ProjectCategory,
  ProjectPatch,
  ProjectStage,
} from '../../../api/types';
import { asAdminRole } from '../adminNav';
import { ConfirmDialog, DeskBanner, DeskPage } from '../kit';
import {
  DARZ_ROLE_DETAIL,
  DELIV_CLASSES,
  INVOICE_STATUSES,
  LANE_STATUSES,
  PROJ_ROLES,
  asDeliverables,
  asLanes,
  asLinks,
  asMoney,
  asStringList,
  choiceLabel,
  choices,
  defaultCurrency,
  lanesToRoles,
  moneyCalc,
  parseList,
  projFlag,
  projMoney,
  scopeGate,
  stageLabel,
  stageState,
  todayIso,
  uid,
  type Deliverable,
  type InvoiceStatus,
  type LinkRow,
  type MoneyAmount,
  type PartnerLane,
  type PaymentStage,
  type ProjectMoney,
} from './projectForm';
import { ProjectProposal } from './ProjectProposal';
import '../admin.css';

/* ── the old detail's own inline styles, kept where it had them ─────────── */
const CHECK = { width: 16, flex: '0 0 auto' } as const; // :13789, :13803
const DATE = { flex: '0 0 auto', width: 140 } as const; // :13789
const AMOUNT = { flex: '0 0 auto', width: 90 } as const; // :13803
const CUR = { flex: '0 0 auto', width: 82 } as const; // :13803
const LABEL = { flex: '0 0 auto', width: 120 } as const; // :13811-13812
const FILE_NAME = { flex: 1, fontSize: 12, color: 'var(--ink2)' } as const; // :13813
const WARN = { color: 'var(--dzp-attn)', marginBottom: 6 } as const; // :13831 (`var(--attn)`)
const GAP12 = { marginTop: 12 } as const; // :13793, :13807-13808, :13815-13816
const GAP8 = { marginTop: 8 } as const; // :13806
const DEL_ROW = { padding: '14px 2px' } as const; // :13867
const FOOT_RIGHT = { display: 'flex', gap: 8, marginLeft: 'auto' } as const; // :13761
const POINTER = { cursor: 'pointer' } as const; // :13767
// the in-flight guard is a bare <fieldset> — no box of its own
const FIELDSET = { border: 0, padding: 0, margin: 0, minWidth: 0 } as const;

/* ── the working copy (`_projDraft`, :13756) ────────────────────────────── */

interface Draft {
  name: string;
  client_partner_org: string;
  client_name: string;
  contact: string;
  category: string;
  venue: string;
  city: string;
  country: string;
  start_date: string;
  end_date: string;
  scope: string;
  darz_resp: string;
  partner_resp: string;
  deliverables: Deliverable[];
  /** the comma-separated inputs as typed (:13795-13796); split on save (`setList`, :13876) */
  teamText: string;
  suppliersText: string;
  lanes: PartnerLane[];
  money: ProjectMoney;
  links: LinkRow[];
  media_links: LinkRow[];
  results: string;
  report: string;
  internal_notes: string;
}

function draftFrom(p: ProjectAdmin, currency: string): Draft {
  return {
    name: p.name ?? '',
    client_partner_org: p.client_partner_org?.id ?? '',
    client_name: p.client_name ?? '',
    contact: p.contact ?? '',
    category: p.category ?? '',
    venue: p.venue ?? '',
    city: p.city ?? '',
    country: p.country ?? '',
    start_date: p.start_date ?? '',
    end_date: p.end_date ?? '',
    scope: p.scope ?? '',
    darz_resp: p.darz_resp ?? '',
    partner_resp: p.partner_resp ?? '',
    deliverables: asDeliverables(p.deliverables),
    teamText: asStringList(p.team).join(', '),
    suppliersText: asStringList(p.suppliers).join(', '),
    lanes: asLanes(p.partner_roles),
    money: asMoney(p.money, currency),
    links: asLinks(p.links),
    media_links: asLinks(p.media_links),
    results: p.results ?? '',
    report: p.report ?? '',
    internal_notes: p.internal_notes ?? '',
  };
}

/** Every editable field in one PATCH body (minus the lock, added per call).
 * Money and internal notes go only when the login may see them. The two
 * partner-org links are send-on-change (PATCH is partial): the update
 * serializer rejects a soft-deleted org that the record still returns, so an
 * untouched client / lane set is left out, and a changed lane set carries only
 * the orgs the page could load (`known`, null until the partners walk lands)
 * — the lane itself stays in `partner_roles`. */
function patchFrom(
  d: Draft,
  canMoney: boolean,
  p: ProjectAdmin,
  known: PartnerOrgAdmin[] | null,
): Omit<ProjectPatch, 'expected_version'> {
  let orgIds = Array.from(new Set(d.lanes.map((l) => l.orgId).filter(Boolean)));
  if (known) orgIds = orgIds.filter((id) => known.some((o) => o.id === id));
  const linked = p.partner_orgs.map((o) => o.id);
  const body: Omit<ProjectPatch, 'expected_version'> = {
    name: d.name,
    client_name: d.client_name,
    contact: d.contact,
    venue: d.venue,
    city: d.city,
    country: d.country,
    start_date: d.start_date || null,
    end_date: d.end_date || null,
    scope: d.scope,
    darz_resp: d.darz_resp,
    partner_resp: d.partner_resp,
    deliverables: d.deliverables,
    team: parseList(d.teamText),
    suppliers: parseList(d.suppliersText),
    partner_roles: lanesToRoles(d.lanes),
    links: d.links,
    media_links: d.media_links,
    results: d.results,
    report: d.report,
  };
  if (d.client_partner_org !== (p.client_partner_org?.id ?? ''))
    body.client_partner_org = d.client_partner_org || null;
  if (orgIds.length !== linked.length || orgIds.some((id) => !linked.includes(id)))
    body.partner_org_ids = orgIds;
  if (d.category) body.category = d.category as ProjectCategory;
  if (canMoney) {
    body.money = d.money;
    body.internal_notes = d.internal_notes;
  }
  return body;
}

/** :13354 `projRoleOverlaps` — the deliverable classes two or more lanes claim. */
function overlapClasses(lanes: PartnerLane[]): Set<string> {
  const count: Record<string, number> = {};
  for (const l of lanes)
    if (l.delivClass) count[l.delivClass] = (count[l.delivClass] ?? 0) + 1;
  return new Set(Object.keys(count).filter((c) => count[c] > 1));
}

/** Every page of a list (partners for the selects, the attachments). */
async function walk<T>(fetchPage: (page: number) => Promise<Paginated<T>>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 50; page++) {
    const p = await fetchPage(page);
    out.push(...p.results);
    if (!p.pagination.has_next) break;
  }
  return out;
}

function errorText(err: unknown, fallback: string): string {
  if (err instanceof ValidationError) {
    const parts = Object.entries(err.fields).map(([k, v]) => `${k}: ${v.join(' ')}`);
    return parts.length ? parts.join(' · ') : err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

export function ProjectPage() {
  const { id = '' } = useParams();
  // keyed on the route id (as PackageEditorPage): one record → another starts
  // a fresh instance, so no draft, section state or late response of the
  // previous id ever shows under the new one
  return <ProjectRecord key={id} id={id} />;
}

function ProjectRecord({ id }: { id: string }) {
  const { projectsAdmin } = useApi();
  const options = useOptions();
  const { me } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const canMoney = asAdminRole(me?.role) === 'owner'; // :13282 projCanMoney()

  const stages = choices(options, 'projects.stage');
  const categories = choices(options, 'projects.category');
  const statuses = choices(options, 'projects.status');
  const currencies = choices(options, 'currency');
  const defCur = defaultCurrency(options);

  const [project, setProject] = useState<ProjectAdmin | null>(null);
  // null until the partners walk lands (or if it fails) — the selects then
  // fall back to the record's own `partner_orgs` mirror for names
  const [partners, setPartners] = useState<PartnerOrgAdmin[] | null>(null);
  const [attachments, setAttachments] = useState<ProjectAttachmentAdmin[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftKey, setDraftKey] = useState('');
  const [gen, setGen] = useState(0);
  const [open, setOpen] = useState<Record<string, boolean>>({}); // `_projOpenSecs`, :13756
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  // the old `Lib.toast` lines as a status line; the New page hands its own in
  const [note, setNote] = useState<string | null>(
    () => (location.state as { note?: string } | null)?.note ?? null,
  );
  const [gate, setGate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // promise chains, not async/await: state is set in the settle callbacks
  // (the `useOptions` shape), never synchronously inside the effect
  const load = useCallback(
    () =>
      projectsAdmin.project(id).then(
        (p) => {
          setError(null);
          setConflict(false);
          setProject(p);
        },
        (err: unknown) => setError(errorText(err, 'Could not load the project.')),
      ),
    [projectsAdmin, id],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const loadAttachments = useCallback(
    () =>
      walk((page) => projectsAdmin.attachments(id, { page, per_page: 100 })).then(
        (rows) => setAttachments(rows),
        (err: unknown) => setError(errorText(err, 'Could not load the attachments.')),
      ),
    [projectsAdmin, id],
  );
  useEffect(() => {
    void loadAttachments();
  }, [loadAttachments]);

  // `projClientOptions()` (:13296) — the partner orgs, for the client and lane
  // selects; a failed walk leaves `partners` null (the selects still name the
  // record's own orgs from its mirror, and no lane set is filtered)
  useEffect(() => {
    let alive = true;
    walk((page) => projectsAdmin.partners({ page, per_page: 100 })).then(
      (rows) => alive && setPartners(rows),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [projectsAdmin]);

  // The working copy is rebuilt from the record each time a fresh version is
  // adopted (save / stage move / archive / reload) — a render-time derived
  // reset keyed on id:version, waiting for the options so money gets its
  // default currency (`projDefCur`, :13287).
  const key = project && options ? `${project.id}:${project.version}:${gen}` : '';
  if (project && key && key !== draftKey) {
    setDraftKey(key);
    setDraft(draftFrom(project, defCur));
  }

  const dirty =
    !!project &&
    !!draft &&
    JSON.stringify(patchFrom(draft, canMoney, project, partners)) !==
      JSON.stringify(patchFrom(draftFrom(project, defCur), canMoney, project, partners));

  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    setConflict(false);
    try {
      await fn();
    } catch (err) {
      if (err instanceof ConflictError) setConflict(true);
      else setError(errorText(err, 'That did not go through.'));
    } finally {
      setBusy(false);
    }
  };

  /** ONE PATCH with every editable field + the lock; adopts the response. */
  const saveDraft = async (
    d: Draft,
    extra: Partial<ProjectPatch> = {},
  ): Promise<ProjectAdmin> => {
    if (!project) throw new Error('No project loaded.');
    const next = await projectsAdmin.updateProject(id, {
      ...patchFrom(d, canMoney, project, partners),
      ...extra,
      expected_version: project.version,
    });
    setProject(next);
    return next;
  };

  // :13893
  const save = () =>
    act(async () => {
      if (!draft) return;
      await saveDraft(draft);
      setNote('Project saved');
    });

  // :13894 — the draft rides along so an unsaved edit is not lost to the adopt
  const archive = (on: boolean) =>
    act(async () => {
      if (!draft) return;
      await saveDraft(draft, { archived: on });
      setNote(on ? 'Project archived' : 'Project unarchived');
    });

  // :13895-13896 — the old removed the device slots too; the server removes its files
  const remove = () =>
    act(async () => {
      await projectsAdmin.deleteProject(id);
      navigate('/admin/projects/list', { state: { note: 'Project deleted' } });
    });

  // :13706-13719 — the rail click. The gate first (:13707-13708); then the
  // move alone (no sub-state seeding — G-PROJ-3), saving unsaved edits first
  // because the move adopts the server's record.
  const moveStage = (target: string) => {
    if (!project || !draft || busy || target === project.stage) return;
    const g = scopeGate(
      { category: draft.category as ProjectCategory, stage: project.stage },
      target,
      stages,
    );
    if (!g.ok) {
      setGate(g.reason);
      return;
    }
    setGate(null);
    void act(async () => {
      let version = project.version;
      if (dirty) version = (await saveDraft(draft)).version;
      const next = await projectsAdmin.setStage(id, target as ProjectStage, version);
      setProject(next);
      setNote('Stage → ' + stageLabel(stages, target)); // :13718
    });
  };

  // attachments (:13889-13891) — server files, outside the draft
  const attach = (file: File) =>
    act(async () => {
      await projectsAdmin.uploadAttachment(id, file);
      await loadAttachments();
    });
  const removeAttachment = (a: ProjectAttachmentAdmin) =>
    act(async () => {
      await projectsAdmin.deleteAttachment(id, a.id);
      await loadAttachments();
    });

  /* ── working-copy setters (:13874-13891) ──────────────────────────────── */
  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const setMoney = (p: Partial<ProjectMoney>) =>
    setDraft((d) => (d ? { ...d, money: { ...d.money, ...p } } : d));
  const setDel = (i: number, p: Partial<Deliverable>) =>
    setDraft((d) =>
      d
        ? { ...d, deliverables: d.deliverables.map((x, j) => (j === i ? { ...x, ...p } : x)) }
        : d,
    );
  const setPay = (i: number, p: Partial<PaymentStage>) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            money: {
              ...d.money,
              payments: d.money.payments.map((x, j) => (j === i ? { ...x, ...p } : x)),
            },
          }
        : d,
    );
  const setLane = (i: number, lane: PartnerLane) =>
    setDraft((d) => (d ? { ...d, lanes: d.lanes.map((x, j) => (j === i ? lane : x)) } : d));
  const isOpen = (k: string, def: boolean) => open[k] ?? def;
  const toggle = (k: string, v: boolean) =>
    setOpen((o) => (o[k] === v ? o : { ...o, [k]: v })); // :13871

  if (!project || !draft) {
    return (
      <DeskPage title="Project">
        {error ? <DeskBanner>{error}</DeskBanner> : <p className="dz-state">Loading…</p>}
      </DeskPage>
    );
  }

  const today = todayIso();
  const flag = projFlag(project, stages, today); // :13757
  const orgs = partners ?? [];
  // an org the loaded list does not carry was deleted on the Partners desk
  // (the list is every non-deleted org) — the record keeps it as recorded
  const gone = (orgId: string) => !!partners && !!orgId && !orgs.some((o) => o.id === orgId);
  // `projClientName` (:13298) — the linked org's name, else the fallback name
  const linkedName = draft.client_partner_org
    ? (orgs.find((o) => o.id === draft.client_partner_org)?.name ??
      (project.client_partner_org?.id === draft.client_partner_org
        ? project.client_partner_org.name
        : ''))
    : '';
  const clientName = linkedName || draft.client_name;
  const overlaps = overlapClasses(draft.lanes);
  const unkeyed = draft.lanes.filter((l) => !l.orgId).length;
  const dupOrgs = draft.lanes.length - unkeyed - Object.keys(lanesToRoles(draft.lanes)).length;
  const m = draft.money;
  const mc = moneyCalc({ money: m }, defCur); // :13800
  const doneBy = me?.display_name || me?.name || me?.email || 'admin'; // :13884 wrote 'admin'

  return (
    <DeskPage title={draft.name || 'Untitled project'}>
      <div className="dzp">
        {/* the whole body sits in one <fieldset> so a write in flight locks the
            inputs: the adopt of its response rebuilds the draft, and anything
            typed in between would be lost */}
        <fieldset disabled={busy} style={FIELDSET}>
          {/* :13758-13759 — eyebrow, chips */}
          <p className="ad-desksub">
            {project.no} · {choiceLabel(categories, draft.category) || '—'}
          </p>
          <div className="dzp-acts">
            <span className="dzp-chip">{clientName || 'No client'}</span>
            <span className={`dzp-pill ${flag.c}`}>{flag.t}</span>
            {canMoney && (
              <Link className="dzp-btn sm" to={`/admin/projects/${id}/report`}>
                Internal report
              </Link>
            )}
            <Link className="dzp-btn sm pri" to={`/admin/projects/${id}/report?client=1`}>
              Client report
            </Link>
          </div>

          {error && <DeskBanner>{error}</DeskBanner>}
          {conflict && (
            <DeskBanner>
              Someone else saved this project in the meantime — reload to continue.{' '}
              <button
                type="button"
                className="dzp-btn sm"
                onClick={() => {
                  setConflict(false);
                  setGen((g) => g + 1);
                  void load();
                }}
              >
                Reload
              </button>
            </DeskBanner>
          )}
          {note && (
            <p className="dzp-mut" role="status">
              {note}
            </p>
          )}

          {/* :13767 — the stage rail; a click moves the project */}
          <div className="dzp-rail">
            {stages.map((s) => (
              <div
                key={s.value}
                className={`dzp-st ${stageState(stages, project.stage, s.value)}`}
                role="button"
                tabIndex={0}
                aria-disabled={busy}
                style={POINTER}
                onClick={() => moveStage(s.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    moveStage(s.value);
                  }
                }}
              >
                <span className="rd" />
                <div className="l">{s.label}</div>
              </div>
            ))}
          </div>
          {gate && (
            // :13708 — `dzConfirm(gate.reason, {okLabel:'Got it'})`
            <div className="dzp-gate" role="alert">
              {gate}
              <div className="dzp-acts">
                <button type="button" className="dzp-btn sm" onClick={() => setGate(null)}>
                  Got it
                </button>
              </div>
            </div>
          )}

          {/* :13775-13787 · :13858 */}
          <Section
            id="overview"
            label="Overview"
            open={isOpen('overview', true)}
            onToggle={toggle}
          >
            <div className="dzp-form">
              <label className="full">
                <span className="fl">Project name</span>
                <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
              </label>
              <label>
                <span className="fl">Client (linked)</span>
                <select
                  value={draft.client_partner_org}
                  onChange={(e) => patch({ client_partner_org: e.target.value })}
                >
                  <option value="">— none —</option>
                  {draft.client_partner_org &&
                    !orgs.some((o) => o.id === draft.client_partner_org) && (
                      <option value={draft.client_partner_org}>
                        {linkedName || draft.client_partner_org}
                      </option>
                    )}
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                {gone(draft.client_partner_org) && (
                  <span className="dzp-mut">
                    This partner org was deleted on the Partners desk — the record keeps it as
                    recorded.
                  </span>
                )}
              </label>
              <label>
                <span className="fl">Client name (fallback)</span>
                <input
                  value={draft.client_name}
                  onChange={(e) => patch({ client_name: e.target.value })}
                />
              </label>
              <label>
                <span className="fl">Main contact</span>
                <input
                  value={draft.contact}
                  onChange={(e) => patch({ contact: e.target.value })}
                />
              </label>
              <label>
                <span className="fl">Category</span>
                <select
                  value={draft.category}
                  onChange={(e) => patch({ category: e.target.value })}
                >
                  {!categories.some((c) => c.value === draft.category) && (
                    <option value={draft.category}>{draft.category || '—'}</option>
                  )}
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {/* :13781 was a <select>; `status` is not writable (G-PROJ-2), so
                  the label wraps an <output> — the derived value, not a field */}
                <span className="fl">Status</span>
                <output>{choiceLabel(statuses, project.status) || '—'}</output>
                <span className="dzp-mut">derived from the stage</span>
              </label>
              <label>
                <span className="fl">Venue / show</span>
                <input
                  value={draft.venue}
                  onChange={(e) => patch({ venue: e.target.value })}
                />
              </label>
              <label>
                <span className="fl">City</span>
                <input value={draft.city} onChange={(e) => patch({ city: e.target.value })} />
              </label>
              <label>
                <span className="fl">Country</span>
                <input
                  value={draft.country}
                  onChange={(e) => patch({ country: e.target.value })}
                />
              </label>
              <label>
                <span className="fl">Start</span>
                <input
                  type="date"
                  value={draft.start_date}
                  onChange={(e) => patch({ start_date: e.target.value })}
                />
              </label>
              <label>
                <span className="fl">End</span>
                <input
                  type="date"
                  value={draft.end_date}
                  onChange={(e) => patch({ end_date: e.target.value })}
                />
              </label>
            </div>
          </Section>

          {/* :13789-13793 · :13859 */}
          <Section
            id="scope"
            label="Scope & deliverables"
            open={isOpen('scope', false)}
            onToggle={toggle}
          >
            <div className="dzp-form">
              <label className="full">
                <span className="fl">Scope of work</span>
                <textarea
                  className="dzp-ta"
                  value={draft.scope}
                  onChange={(e) => patch({ scope: e.target.value })}
                />
              </label>
              <label>
                <span className="fl">Darz responsibilities</span>
                <textarea
                  className="dzp-ta"
                  value={draft.darz_resp}
                  onChange={(e) => patch({ darz_resp: e.target.value })}
                />
              </label>
              <label>
                <span className="fl">Partner responsibilities</span>
                <textarea
                  className="dzp-ta"
                  value={draft.partner_resp}
                  onChange={(e) => patch({ partner_resp: e.target.value })}
                />
              </label>
            </div>
            <div style={GAP12}>
              <div className="dzp-fl">Deliverables</div>
              {draft.deliverables.length ? (
                draft.deliverables.map((x, i) => (
                  <div className="dzp-line" key={x.id || `d${i}`}>
                    <input
                      type="checkbox"
                      checked={x.done}
                      style={CHECK}
                      aria-label="Done"
                      onChange={(e) =>
                        // :13884 toggleDel
                        setDel(i, {
                          done: e.target.checked,
                          doneTs: e.target.checked ? Date.now() : 0,
                          doneBy: e.target.checked ? doneBy : '',
                        })
                      }
                    />
                    <input
                      value={x.text}
                      placeholder="Deliverable"
                      aria-label="Deliverable"
                      onChange={(e) => setDel(i, { text: e.target.value })}
                    />
                    <input
                      type="date"
                      style={DATE}
                      value={x.due}
                      aria-label="Due"
                      onChange={(e) => setDel(i, { due: e.target.value })}
                    />
                    <button
                      type="button"
                      className="dzp-btn sm dgr gho"
                      aria-label="Remove deliverable"
                      onClick={() =>
                        patch({ deliverables: draft.deliverables.filter((_, j) => j !== i) })
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))
              ) : (
                <div className="dzp-mut">No deliverables yet.</div>
              )}
              <div className="dzp-acts">
                <button
                  type="button"
                  className="dzp-btn sm"
                  onClick={() =>
                    // :13882 addDel
                    patch({
                      deliverables: [
                        ...draft.deliverables,
                        {
                          id: uid('dl'),
                          text: '',
                          owner: '',
                          due: '',
                          depId: '',
                          done: false,
                          doneTs: 0,
                          doneBy: '',
                        },
                      ],
                    })
                  }
                >
                  ＋ Add deliverable
                </button>
              </div>
            </div>
          </Section>

          {/* :13795-13796 · :13860 */}
          <Section id="team" label="Team" open={isOpen('team', false)} onToggle={toggle}>
            <div className="dzp-form">
              <label className="full">
                <span className="fl">Team members (comma-separated)</span>
                <input
                  value={draft.teamText}
                  onChange={(e) => patch({ teamText: e.target.value })}
                />
              </label>
              <label className="full">
                <span className="fl">External suppliers (comma-separated)</span>
                <input
                  value={draft.suppliersText}
                  onChange={(e) => patch({ suppliersText: e.target.value })}
                />
              </label>
            </div>
          </Section>

          {/* :13823-13849 · :13861 */}
          <Section
            id="partners"
            label="Partners & roles"
            open={isOpen('partners', false)}
            onToggle={toggle}
          >
            {draft.lanes.length ? (
              draft.lanes.map((lane, i) => (
                <LaneCard
                  key={i}
                  lane={lane}
                  warn={!!lane.delivClass && overlaps.has(lane.delivClass)}
                  partners={orgs}
                  // the record's own `{id, name}` mirror names an org the list no longer has
                  mirrorName={
                    project.partner_orgs.find((o) => o.id === lane.orgId)?.name ?? ''
                  }
                  gone={gone(lane.orgId)}
                  onChange={(next) => setLane(i, next)}
                  onRemove={() => patch({ lanes: draft.lanes.filter((_, j) => j !== i) })} // :15439
                />
              ))
            ) : (
              // :13847
              <div className="dzp-mut">
                No partner roles yet. Add each org’s lane so responsibilities never silently
                collide.
              </div>
            )}
            {(unkeyed > 0 || dupOrgs > 0) && (
              <div className="dzp-mut" style={GAP8}>
                The record keeps one lane per partner org
                {unkeyed > 0
                  ? ` — ${unkeyed} lane${unkeyed === 1 ? '' : 's'} without a partner will not be saved`
                  : ''}
                {dupOrgs > 0
                  ? ` — for a partner with two lanes only the later one is kept`
                  : ''}
                .
              </div>
            )}
            <div className="dzp-acts">
              <button
                type="button"
                className="dzp-btn sm"
                onClick={() =>
                  // :15437 addRole
                  patch({
                    lanes: [
                      ...draft.lanes,
                      {
                        orgId: '',
                        role: 'media',
                        delivClass: '',
                        deliverables: '',
                        deadline: '',
                        contact: '',
                        materials: '',
                        ownership: '',
                        channels: '',
                        approval: '',
                        budget: '',
                        dependsOn: '',
                        status: 'on-track',
                      },
                    ],
                  })
                }
              >
                ＋ Add partner role
              </button>
            </div>
            {/* :13849 */}
            <div className="dzp-darz">
              <div className="h">{DARZ_ROLE_DETAIL.h}</div>
              <p>{DARZ_ROLE_DETAIL.p}</p>
            </div>
          </Section>

          {/* :13851-13855 · :13862 — only once a package is applied */}
          {project.applied_package && (
            <Section
              id="proposal"
              label="Proposal"
              open={isOpen('proposal', false)}
              onToggle={toggle}
            >
              <ProjectProposal
                project={project}
                canMoney={canMoney}
                onIssued={() => setNote('Proposal finalized & saved to the Library')} // :14108
              />
            </Section>
          )}

          {/* :13798-13809 · :13863 — owner only */}
          {canMoney && (
            <Section id="money" label="Money" open={isOpen('money', false)} onToggle={toggle}>
              <div className="dzp-form">
                <MoneyField
                  label="Internal cost"
                  value={m.internalCost}
                  currencies={currencies}
                  onChange={(v) => setMoney({ internalCost: v })}
                />
                <MoneyField
                  label="External cost"
                  value={m.externalCost}
                  currencies={currencies}
                  onChange={(v) => setMoney({ externalCost: v })}
                />
                <MoneyField
                  label="Darz service fee"
                  value={m.fee}
                  currencies={currencies}
                  onChange={(v) => setMoney({ fee: v })}
                />
                <MoneyField
                  label="Total client price"
                  value={m.clientPrice}
                  currencies={currencies}
                  onChange={(v) => setMoney({ clientPrice: v })}
                />
              </div>
              <div className="dzp-form" style={GAP8}>
                {/* :13804 */}
                <label>
                  <span className="fl">Invoice status</span>
                  <select
                    value={m.invoiceStatus}
                    onChange={(e) =>
                      setMoney({ invoiceStatus: e.target.value as InvoiceStatus })
                    }
                  >
                    {INVOICE_STATUSES.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={GAP12}>
                <div className="dzp-fl">Payment schedule</div>
                {m.payments.length ? (
                  m.payments.map((p, i) => (
                    <div className="dzp-line" key={p.id || `p${i}`}>
                      <input
                        type="checkbox"
                        checked={p.paid}
                        style={CHECK}
                        aria-label="Paid"
                        onChange={(e) =>
                          // :13880 — paidTs follows the tick
                          setPay(i, {
                            paid: e.target.checked,
                            paidTs: e.target.checked ? Date.now() : 0,
                          })
                        }
                      />
                      <input
                        value={p.label}
                        placeholder="Stage / label"
                        aria-label="Stage / label"
                        onChange={(e) => setPay(i, { label: e.target.value })}
                      />
                      <input
                        value={p.amount}
                        placeholder="0"
                        inputMode="decimal"
                        style={AMOUNT}
                        aria-label="Amount"
                        onChange={(e) => setPay(i, { amount: e.target.value })}
                      />
                      <select
                        style={CUR}
                        value={p.currency}
                        aria-label="Currency"
                        onChange={(e) => setPay(i, { currency: e.target.value })}
                      >
                        <CurrencyOptions currencies={currencies} current={p.currency} />
                      </select>
                      <button
                        type="button"
                        className="dzp-btn sm dgr gho"
                        aria-label="Remove stage"
                        onClick={() =>
                          setMoney({ payments: m.payments.filter((_, j) => j !== i) })
                        }
                      >
                        ✕
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="dzp-mut">No payment stages yet.</div>
                )}
                <div className="dzp-acts">
                  <button
                    type="button"
                    className="dzp-btn sm"
                    onClick={() =>
                      // :13879 addPay
                      setMoney({
                        payments: [
                          ...m.payments,
                          {
                            id: uid('pay'),
                            label: '',
                            amount: '',
                            currency: defCur,
                            due: '',
                            paid: false,
                            paidTs: 0,
                          },
                        ],
                      })
                    }
                  >
                    ＋ Add stage
                  </button>
                </div>
              </div>
              <div style={GAP12}>
                {/* :13801 */}
                <div className="dzp-fl">Totals (grouped by currency — never converted)</div>
                {mc.currencies.length ? (
                  mc.currencies.map((c) => {
                    const b = mc.byCur[c];
                    return (
                      <div className="dzp-mrow" key={c}>
                        <span>{c}</span>
                        <b>
                          Client {projMoney(b.client, c)} · Fee {projMoney(b.fee, c)} · Cost{' '}
                          {projMoney(b.internal + b.external, c)}
                          {b.paid || b.due
                            ? ` · Paid ${projMoney(b.paid, c)} / Due ${projMoney(b.due, c)}`
                            : ''}
                        </b>
                      </div>
                    );
                  })
                ) : (
                  <div className="dzp-mut">No amounts recorded yet.</div>
                )}
              </div>
            </Section>
          )}

          {/* :13811-13816 · :13864 */}
          <Section
            id="files"
            label="Files & links"
            open={isOpen('files', false)}
            onToggle={toggle}
          >
            {/* :13814 read "Attachments (kept on this device)" — they are server files now */}
            <div className="dzp-fl">Attachments</div>
            {attachments === null ? (
              <p className="dz-state">Loading…</p>
            ) : attachments.length ? (
              attachments.map((a) => (
                <div className="dzp-line" key={a.id}>
                  <span style={FILE_NAME}>{a.original_name || a.label || 'File'}</span>
                  <a
                    className="dzp-btn sm gho"
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open
                  </a>
                  <button
                    type="button"
                    className="dzp-btn sm dgr gho"
                    disabled={busy}
                    aria-label={`Remove ${a.original_name || 'file'}`}
                    onClick={() => void removeAttachment(a)}
                  >
                    ✕
                  </button>
                </div>
              ))
            ) : (
              <div className="dzp-mut">No files attached.</div>
            )}
            <div className="dzp-acts">
              <button
                type="button"
                className="dzp-btn sm"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                ＋ Attach file
              </button>
              <input
                ref={fileInput}
                type="file"
                hidden
                aria-hidden="true"
                tabIndex={-1}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void attach(f);
                }}
              />
            </div>
            <div style={GAP12}>
              <div className="dzp-fl">Links</div>
              <LinkRows
                rows={draft.links}
                empty="No links."
                addLabel="＋ Add link"
                onChange={(rows) => patch({ links: rows })}
              />
            </div>
            <div style={GAP12}>
              <div className="dzp-fl">Media &amp; publication links</div>
              <LinkRows
                rows={draft.media_links}
                empty="No media links."
                addLabel="＋ Add media link"
                onChange={(rows) => patch({ media_links: rows })}
              />
            </div>
          </Section>

          {/* :13818-13819 · :13865 */}
          <Section
            id="results"
            label="Results"
            open={isOpen('results', false)}
            onToggle={toggle}
          >
            <div className="dzp-form">
              <label className="full">
                <span className="fl">Performance results</span>
                <textarea
                  className="dzp-ta"
                  value={draft.results}
                  onChange={(e) => patch({ results: e.target.value })}
                />
              </label>
              <label className="full">
                <span className="fl">Final report</span>
                <textarea
                  className="dzp-ta"
                  value={draft.report}
                  onChange={(e) => patch({ report: e.target.value })}
                />
              </label>
            </div>
          </Section>

          {/* :13821 · :13866 — owner only */}
          {canMoney && (
            <Section
              id="internal"
              label="Internal notes"
              open={isOpen('internal', false)}
              onToggle={toggle}
            >
              <div className="dzp-form">
                <label className="full">
                  <span className="fl">
                    Internal notes — never appears in any client-facing export
                  </span>
                  <textarea
                    className="dzp-ta"
                    value={draft.internal_notes}
                    onChange={(e) => patch({ internal_notes: e.target.value })}
                  />
                </label>
              </div>
            </Section>
          )}

          {/* :13867 */}
          <div style={DEL_ROW}>
            <button
              type="button"
              className="dzp-btn gho sm dgr"
              disabled={busy}
              onClick={() => setDeleting(true)}
            >
              Delete project
            </button>
          </div>

          {/* :13761-13763 — the modal footer */}
          <div className="dzp-acts">
            <button
              type="button"
              className="dzp-btn gho"
              disabled={busy}
              // `_close` (:13761) returned to wherever the modal was opened from;
              // a deep link has no entry behind it, so that one goes to the list
              onClick={() =>
                location.key === 'default' ? navigate('/admin/projects/list') : navigate(-1)
              }
            >
              Cancel
            </button>
            {dirty && <span className="dzp-mut">unsaved changes</span>}
            <span style={FOOT_RIGHT}>
              {project.archived ? (
                <button
                  type="button"
                  className="dzp-btn"
                  disabled={busy}
                  onClick={() => void archive(false)}
                >
                  Unarchive
                </button>
              ) : (
                <button
                  type="button"
                  className="dzp-btn"
                  disabled={busy}
                  onClick={() => void archive(true)}
                >
                  Archive
                </button>
              )}
              <button
                type="button"
                className="dzp-btn pri"
                disabled={busy}
                onClick={() => void save()}
              >
                Save
              </button>
            </span>
          </div>
        </fieldset>
      </div>

      {deleting && (
        // :13896 — "Attachments on this device" became the server's files
        <ConfirmDialog
          message="Delete this project permanently? Its attachments are removed too."
          okLabel="Delete"
          danger
          busy={busy}
          onCancel={() => setDeleting(false)}
          onConfirm={() => {
            setDeleting(false);
            void remove();
          }}
        />
      )}
    </DeskPage>
  );
}

/* ── pieces (module-level: no components inside components) ─────────────── */

/** `_sec` (:13870) — a `<details>` whose open state the page remembers. */
function Section({
  id,
  label,
  open,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  open: boolean;
  onToggle: (id: string, open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details
      className="dzp-sec"
      open={open}
      onToggle={(e: SyntheticEvent<HTMLDetailsElement>) => onToggle(id, e.currentTarget.open)}
    >
      <summary className="dzp-secsum">{label}</summary>
      <div className="dzp-secbody">{children}</div>
    </details>
  );
}

/** `projCurOpts` — the currency choices, plus the current code when it is
 * not among them (an old blob's currency still shows rather than jumping). */
function CurrencyOptions({ currencies, current }: { currencies: Choice[]; current: string }) {
  return (
    <>
      {current && !currencies.some((c) => c.value === current) && (
        <option value={current}>{current}</option>
      )}
      {!current && <option value="">—</option>}
      {currencies.map((c) => (
        <option key={c.value} value={c.value}>
          {c.value}
        </option>
      ))}
    </>
  );
}

/** `mf` (:13802) — one amount + currency field of the Money section. */
function MoneyField({
  label,
  value,
  currencies,
  onChange,
}: {
  label: string;
  value: MoneyAmount;
  currencies: Choice[];
  onChange: (v: MoneyAmount) => void;
}) {
  return (
    <label>
      <span className="fl">{label}</span>
      <div className="dzp-money">
        <input
          value={value.amount}
          placeholder="0"
          inputMode="decimal"
          onChange={(e) => onChange({ ...value, amount: e.target.value })}
        />
        <select
          value={value.currency}
          aria-label={`${label} currency`}
          onChange={(e) => onChange({ ...value, currency: e.target.value })}
        >
          <CurrencyOptions currencies={currencies} current={value.currency} />
        </select>
      </div>
    </label>
  );
}

/** :13811-13812 + :13886-13888 — label/url rows with ✕ and an add button. */
function LinkRows({
  rows,
  empty,
  addLabel,
  onChange,
}: {
  rows: LinkRow[];
  empty: string;
  addLabel: string;
  onChange: (rows: LinkRow[]) => void;
}) {
  return (
    <>
      {rows.length ? (
        rows.map((x, i) => (
          <div className="dzp-line" key={i}>
            <input
              value={x.label}
              placeholder="Label"
              aria-label="Label"
              style={LABEL}
              onChange={(e) =>
                onChange(rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))
              }
            />
            <input
              value={x.url}
              placeholder="https://…"
              aria-label="URL"
              onChange={(e) =>
                onChange(rows.map((r, j) => (j === i ? { ...r, url: e.target.value } : r)))
              }
            />
            <button
              type="button"
              className="dzp-btn sm dgr gho"
              aria-label="Remove link"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))
      ) : (
        <div className="dzp-mut">{empty}</div>
      )}
      <div className="dzp-acts">
        <button
          type="button"
          className="dzp-btn sm"
          onClick={() => onChange([...rows, { label: '', url: '' }])}
        >
          {addLabel}
        </button>
      </div>
    </>
  );
}

/** :13825-13846 — one partner's lane, with the overlap guard line. An org the
 * partner list no longer carries keeps its name from the record's mirror
 * (`mirrorName`), and `gone` says so under the select. */
function LaneCard({
  lane,
  warn,
  partners,
  mirrorName,
  gone,
  onChange,
  onRemove,
}: {
  lane: PartnerLane;
  warn: boolean;
  partners: PartnerOrgAdmin[];
  mirrorName: string;
  gone: boolean;
  onChange: (lane: PartnerLane) => void;
  onRemove: () => void;
}) {
  const set = (p: Partial<PartnerLane>) => onChange({ ...lane, ...p });
  return (
    <div className={`dzp-role${warn ? ' warn' : ''}`}>
      {warn && (
        <div className="dzp-mut" style={WARN}>
          Overlap — another partner owns the same deliverable class (
          {choiceLabel(DELIV_CLASSES, lane.delivClass)}).
        </div>
      )}
      <div className="dzp-form">
        <label>
          <span className="fl">Partner</span>
          <select value={lane.orgId} onChange={(e) => set({ orgId: e.target.value })}>
            <option value="">— partner —</option>
            {lane.orgId && !partners.some((o) => o.id === lane.orgId) && (
              <option value={lane.orgId}>{mirrorName || lane.orgId}</option>
            )}
            {partners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {gone && (
            <span className="dzp-mut">
              This partner org was deleted on the Partners desk — the record keeps it as
              recorded.
            </span>
          )}
        </label>
        <label>
          <span className="fl">Main role</span>
          <select value={lane.role} onChange={(e) => set({ role: e.target.value })}>
            {!PROJ_ROLES.some((r) => r.value === lane.role) && (
              <option value={lane.role}>{lane.role || '—'}</option>
            )}
            {PROJ_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="fl">Deliverable class (overlap guard)</span>
          <select
            value={lane.delivClass}
            onChange={(e) => set({ delivClass: e.target.value })}
          >
            {DELIV_CLASSES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="fl">Completion status</span>
          <select
            value={lane.status}
            onChange={(e) => set({ status: e.target.value as PartnerLane['status'] })}
          >
            {LANE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="full">
          <span className="fl">Deliverables owned</span>
          <input
            value={lane.deliverables}
            onChange={(e) => set({ deliverables: e.target.value })}
          />
        </label>
        <label>
          <span className="fl">Deadline</span>
          <input
            type="date"
            value={lane.deadline}
            onChange={(e) => set({ deadline: e.target.value })}
          />
        </label>
        <label>
          <span className="fl">Assigned contact</span>
          <input value={lane.contact} onChange={(e) => set({ contact: e.target.value })} />
        </label>
        <label className="full">
          <span className="fl">Required materials</span>
          <input value={lane.materials} onChange={(e) => set({ materials: e.target.value })} />
        </label>
        <label>
          <span className="fl">Content ownership</span>
          <input value={lane.ownership} onChange={(e) => set({ ownership: e.target.value })} />
        </label>
        <label>
          <span className="fl">Publication channels</span>
          <input value={lane.channels} onChange={(e) => set({ channels: e.target.value })} />
        </label>
        <label>
          <span className="fl">Approval authority</span>
          <input value={lane.approval} onChange={(e) => set({ approval: e.target.value })} />
        </label>
        <label>
          <span className="fl">Budget responsibility</span>
          <input value={lane.budget} onChange={(e) => set({ budget: e.target.value })} />
        </label>
        <label className="full">
          <span className="fl">Dependencies on other partners</span>
          <input value={lane.dependsOn} onChange={(e) => set({ dependsOn: e.target.value })} />
        </label>
      </div>
      <div className="dzp-acts">
        <button type="button" className="dzp-btn sm gho dgr" onClick={onRemove}>
          Remove partner role
        </button>
      </div>
    </div>
  );
}
