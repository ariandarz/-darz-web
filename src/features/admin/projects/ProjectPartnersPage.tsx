/**
 * ProjectPartnersPage — `/admin/projects/partners`, the Partners desk
 * (`DZProjects.partners` / `partSearch` / `_matrix` / `newOrg` / `editOrg`
 * / `_orgModal` / `orgSet` / `saveOrg` / `delOrg`, `darz-studio.html:
 * 15380-15434`) over `/projects/admin/partners/` plus one walk of the
 * active projects.
 *
 * Ported content:
 *  - the heading, the sub (:15400), "＋ Partner org" (:15401) and
 *    "Search partners…" (:15402);
 *  - the overlap banner (:15385): active projects where two partners own
 *    the same deliverable class (`projHasOverlap`, :13354-13355);
 *  - the org cards (:15386-15394): name, kind · city, "N active
 *    project(s)" (`projForOrg`, :13352 — client, linked partner or a lane)
 *    and "Roles: …" from the org's lanes across those projects (:15388),
 *    Edit / Delete, "No partner organisations yet.";
 *  - the editor (:15420-15431): Organisation name, Kind (with its
 *    placeholder), Contact, City, Country, Notes; Cancel / "Save partner";
 *    "Name the organisation" (:15433) and "Partner saved" (:15433);
 *  - the Delete confirm (:15434);
 *  - one responsibility matrix per active project with lanes (:15396,
 *    :15410-15417 — Partner / Role / Deliverables / Ownership / Channels /
 *    Status, overlap rows tinted, "Open project"), each followed by the
 *    Darz card (:15418); the 13 Vanak worked example after the matrices, or
 *    alone when there are none (:15398, :15405-15406).
 *
 * Mechanics that changed:
 *  - partners are server-paged and server-searched (`PartnerOrgQuery.
 *    search`); the grid keeps the old card markup and takes the kit's
 *    Pager. The old 170 ms debounce (:15409) is not ported.
 *  - the per-org counts, the roles, the overlap banner and the matrices
 *    need every active project; the API has no partner filter (G-PROJ-1),
 *    so the page walks `archived: false, per_page: 100` once per visit.
 *    "Active" here is the old `!archived` (:15387, :15396), not the
 *    stage-aware `isActive`.
 *  - the editor is an inline `.dzp-panel` in place of the modal;
 *    `updatePartner` carries `expected_version`, and a 409 is a banner
 *    with a Reload button.
 *  - the gallery rows (:15382, :15390-15392): the old panel merged the
 *    galleries from Sources & Partners into this grid, read-only. Those
 *    links have their own API and desk here (`/admin/sources`) and are NOT
 *    merged — a note above the grid says so instead of a second fetch.
 *  - matrix partner names: the old `projOrgName` (:13297) had every org in
 *    memory; this page holds one page of them, so a lane's name resolves
 *    from the project's own `partner_orgs` mirror (`{id, name}`) first,
 *    then the loaded partner page, then '—'.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConflictError } from '../../../api/errors';
import { useApi } from '../../../api/hooks';
import type { ProjectsAdminService } from '../../../api/services';
import type {
  Paginated,
  PartnerOrgAdmin,
  PartnerOrgInput,
  PartnerOrgQuery,
  ProjectAdmin,
} from '../../../api/types';
import { ListController } from '../../shared/ListController';
import { useListController } from '../../shared/useListController';
import {
  ConfirmDialog,
  DeskAction,
  DeskBanner,
  DeskPage,
  Pager,
  SearchFilter,
  deskBanner,
  resolveDeskView,
} from '../kit';
import {
  DARZ_ROLE_MATRIX,
  DELIV_CLASSES,
  PROJ_ROLES,
  VANAK_EXAMPLE,
  asLanes,
  choiceLabel,
  clientName,
  walkProjects,
  type PartnerLane,
} from './projectForm';
import '../admin.css';

const CONFLICT = 'Someone else saved this partner in the meantime — reload to continue.';

class PartnersController extends ListController<PartnerOrgAdmin, PartnerOrgQuery> {
  private readonly projects: ProjectsAdminService;
  constructor(projects: ProjectsAdminService, initial: PartnerOrgQuery = {}) {
    super(initial);
    this.projects = projects;
  }
  protected fetchPage(query: PartnerOrgQuery): Promise<Paginated<PartnerOrgAdmin>> {
    return this.projects.partners(query);
  }
}

/** A project with its lanes read once. */
interface Entry {
  p: ProjectAdmin;
  lanes: PartnerLane[];
}

/** `projRoleLabel` (:13331) / `projDelivClassLabel` (:13332) — the dash fallback. */
const roleLabel = (r: string): string => choiceLabel(PROJ_ROLES, r) || '—';
const classLabel = (c: string): string => choiceLabel(DELIV_CLASSES, c) || '—';

/** `projForOrg` (:13352): the org is the client, a linked partner or owns a lane. */
function projectsForOrg(entries: Entry[], orgId: string): Entry[] {
  return entries.filter(
    ({ p, lanes }) =>
      p.client_partner_org?.id === orgId ||
      p.partner_orgs.some((x) => x.id === orgId) ||
      lanes.some((l) => l.orgId === orgId),
  );
}

/** :15388-15389 — the org's distinct role labels across its projects. */
function roleText(entries: Entry[], orgId: string): string {
  const names = new Set<string>();
  for (const { lanes } of entries)
    for (const l of lanes) if (l.orgId === orgId && l.role) names.add(roleLabel(l.role));
  return [...names].join(' · ') || '—';
}

/** `projRoleOverlaps` (:13354): the deliverable classes two or more lanes own. */
function roleOverlaps(lanes: PartnerLane[]): Set<string> {
  const by = new Map<string, number>();
  for (const l of lanes)
    if (l.delivClass) by.set(l.delivClass, (by.get(l.delivClass) ?? 0) + 1);
  const out = new Set<string>();
  for (const [c, n] of by) if (n > 1) out.add(c);
  return out;
}

/** The editor's fields (:15420 `_orgDraft`). */
interface OrgDraft {
  name: string;
  kind: string;
  contact: string;
  city: string;
  country: string;
  notes: string;
}

interface Editor {
  /** null = new (:15420); an id = edit (:15421), with its version for the lock */
  id: string | null;
  version: number;
  draft: OrgDraft;
}

const blankDraft = (): OrgDraft => ({
  name: '',
  kind: '',
  contact: '',
  city: '',
  country: '',
  notes: '',
});

export function ProjectPartnersPage() {
  const { projectsAdmin } = useApi();

  const { state, setQuery, setPage, reload } = useListController<
    PartnerOrgAdmin,
    PartnerOrgQuery
  >(() => new PartnersController(projectsAdmin));

  // the active projects, walked once per visit (G-PROJ-1)
  const [walk, setWalk] = useState<{ rows: ProjectAdmin[] | null; error: string | null }>({
    rows: null,
    error: null,
  });
  useEffect(() => {
    let alive = true;
    walkProjects(projectsAdmin).then(
      (rows) => alive && setWalk({ rows, error: null }),
      (err: unknown) =>
        alive &&
        setWalk({
          rows: null,
          error: err instanceof Error ? err.message : 'Could not load the projects.',
        }),
    );
    return () => {
      alive = false;
    };
  }, [projectsAdmin]);

  const entries = useMemo<Entry[]>(
    () => (walk.rows ?? []).map((p) => ({ p, lanes: asLanes(p.partner_roles) })),
    [walk.rows],
  );
  const overlapProjects = entries.filter(({ lanes }) => roleOverlaps(lanes).size > 0); // :15384
  const withLanes = entries.filter(({ lanes }) => lanes.length > 0); // :15396

  const [editor, setEditor] = useState<Editor | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<PartnerOrgAdmin | null>(null);

  const open = (next: Editor) => {
    setFormError(null);
    setNote(null);
    setEditor(next);
  };
  const newOrg = () => open({ id: null, version: 0, draft: blankDraft() }); // :15420
  const editOrg = (o: PartnerOrgAdmin) =>
    open({
      id: o.id,
      version: o.version,
      draft: {
        name: o.name,
        kind: o.kind ?? '',
        contact: o.contact ?? '',
        city: o.city ?? '',
        country: o.country ?? '',
        notes: o.notes ?? '',
      },
    }); // :15421
  const orgSet = (patch: Partial<OrgDraft>) =>
    setEditor((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e)); // :15432

  /** `saveOrg` (:15433). */
  const saveOrg = async () => {
    if (!editor || busy) return;
    const d = editor.draft;
    if (!d.name.trim()) {
      setFormError('Name the organisation');
      return;
    }
    setFormError(null);
    setActionError(null);
    setConflict(false);
    setBusy(true);
    const body: PartnerOrgInput = { ...d, name: d.name.trim() };
    try {
      if (editor.id)
        await projectsAdmin.updatePartner(editor.id, {
          ...body,
          expected_version: editor.version,
        });
      else await projectsAdmin.createPartner(body);
      setEditor(null);
      setNote('Partner saved');
      await reload();
    } catch (err: unknown) {
      if (err instanceof ConflictError) setConflict(true);
      else setActionError(err instanceof Error ? err.message : 'Could not save the partner.');
    } finally {
      setBusy(false);
    }
  };

  /** `delOrg` (:15434), after the confirm. */
  const delOrg = async (o: PartnerOrgAdmin) => {
    setActionError(null);
    setNote(null);
    try {
      await projectsAdmin.deletePartner(o.id);
      if (editor?.id === o.id) setEditor(null);
      await reload();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Could not delete the partner.');
    }
  };

  const reloadAll = () => {
    setConflict(false);
    setActionError(null);
    setEditor(null);
    void reload();
  };

  /** `projOrgName` (:13297) for a lane — the project's own mirror first. */
  const nameOf = (p: ProjectAdmin, orgId: string): string =>
    p.partner_orgs.find((x) => x.id === orgId)?.name ||
    state.results.find((o) => o.id === orgId)?.name ||
    '—';

  const body = resolveDeskView(state.status, state.results.length);
  const banner = deskBanner(state.status, state.error, actionError);
  const loading = body === 'loading' || (walk.rows === null && !walk.error);

  return (
    <DeskPage
      title="Partners"
      action={
        // :15401
        <DeskAction onClick={newOrg}>＋ Partner org</DeskAction>
      }
      toolbar={
        // :15402
        <SearchFilter
          label="Search"
          value={state.query.search}
          onChange={(search) => setQuery({ search })}
          placeholder="Search partners…"
        />
      }
    >
      {/* :15400 */}
      <p className="ad-desksub">
        Partner organisations and their roles across projects. Each partner’s lane is explicit;
        two partners owning the same deliverable class flags amber on both — responsibilities
        never silently collide.
      </p>

      <div className="dzp">
        {conflict && (
          <DeskBanner>
            {CONFLICT}{' '}
            <button type="button" className="dzp-btn sm" onClick={reloadAll}>
              Reload
            </button>
          </DeskBanner>
        )}
        {banner && <DeskBanner>{banner}</DeskBanner>}
        {walk.error && <DeskBanner>{walk.error}</DeskBanner>}
        {note && (
          <p className="dzp-mut" role="status">
            {note}
          </p>
        )}

        {/* stated absence — :15382 merged the Sources & Partners galleries in here */}
        <p className="dzp-mut" role="note">
          Galleries linked under Sources &amp; Partners are not merged into this list — they
          stay{' '}
          <Link to="/admin/sources" style={{ color: 'var(--magenta)' }}>
            managed in Sources &amp; Partners
          </Link>
          .
        </p>

        {editor && (
          <OrgEditor
            title={editor.id ? 'Edit partner org' : 'New partner org'}
            draft={editor.draft}
            error={formError}
            busy={busy}
            onChange={orgSet}
            onCancel={() => setEditor(null)}
            onSave={() => void saveOrg()}
          />
        )}

        {/* :15385 */}
        {overlapProjects.length > 0 && (
          <div className="dzp-gate" role="alert" style={{ marginTop: 0, marginBottom: 12 }}>
            {overlapProjects.length} project{overlapProjects.length > 1 ? 's have' : ' has'}{' '}
            two partners owning the same deliverable class —{' '}
            {overlapProjects.map(({ p }) => p.name || p.no).join(', ')}. Open the project’s
            Partners section to resolve.
          </div>
        )}

        {loading && <p className="dz-state">Loading…</p>}

        {!loading && body !== 'error' && (
          <>
            <div className="dzp-pkgs">
              {body === 'rows' ? (
                state.results.map((o) => {
                  const mine = projectsForOrg(entries, o.id); // :15387
                  return (
                    <OrgCard
                      key={o.id}
                      o={o}
                      count={mine.length}
                      roles={roleText(mine, o.id)}
                      onEdit={() => editOrg(o)}
                      onDelete={() => setRemoving(o)}
                    />
                  );
                })
              ) : (
                // :15394 — the empty card spans the grid
                <div className="dzp-empty" style={{ gridColumn: '1 / -1' }}>
                  No partner organisations yet.
                </div>
              )}
            </div>
            {state.pagination && <Pager pagination={state.pagination} onPage={setPage} />}

            {/* :15396-15397, :15405 — one matrix per active project with lanes */}
            {withLanes.map(({ p, lanes }) => (
              <Matrix key={p.id} p={p} lanes={lanes} nameOf={(orgId) => nameOf(p, orgId)} />
            ))}
            {/* :15405-15406 — the worked example, alone or after the matrices */}
            <VanakCard />
          </>
        )}
      </div>

      {removing && (
        // :15434
        <ConfirmDialog
          message="Delete this partner organisation? Projects keep their recorded roles."
          okLabel="Delete"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const o = removing;
            setRemoving(null);
            void delOrg(o);
          }}
        />
      )}
    </DeskPage>
  );
}

/** One `.dzp-pkg` (:15390-15393). */
function OrgCard({
  o,
  count,
  roles,
  onEdit,
  onDelete,
}: {
  o: PartnerOrgAdmin;
  count: number;
  roles: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="dzp-pkg">
      <div className="pn">{o.name || 'Partner'}</div>
      <div className="pp">
        {o.kind || 'org'}
        {o.city ? ` · ${o.city}` : ''}
      </div>
      <div className="pl">
        <b>{count}</b> active project{count === 1 ? '' : 's'}
        <br />
        Roles: {roles}
      </div>
      <div className="dzp-acts">
        <button type="button" className="dzp-btn sm" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="dzp-btn sm gho dgr" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

/** `_orgModal` (:15422-15431) as an inline panel: the same six fields, the
 * same two buttons. The modal head's eyebrow "Partners" + title become the
 * desk's own section heading recipe. */
function OrgEditor({
  title,
  draft,
  error,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  title: string;
  draft: OrgDraft;
  error: string | null;
  busy: boolean;
  onChange: (patch: Partial<OrgDraft>) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="dzp-panel" style={{ padding: '12px 15px 14px', marginBottom: 14 }}>
      <div className="ad-dsec-h">
        <h2 className="ad-dsec-t">{title}</h2>
        <span className="ad-dsec-n">Partners</span>
      </div>
      <div className="dzp-form">
        <label className="full">
          <span className="fl">Organisation name</span>
          <input value={draft.name} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <label>
          <span className="fl">Kind</span>
          <input
            value={draft.kind}
            placeholder="studio / media / venue / listings"
            onChange={(e) => onChange({ kind: e.target.value })}
          />
        </label>
        <label>
          <span className="fl">Contact</span>
          <input
            value={draft.contact}
            onChange={(e) => onChange({ contact: e.target.value })}
          />
        </label>
        <label>
          <span className="fl">City</span>
          <input value={draft.city} onChange={(e) => onChange({ city: e.target.value })} />
        </label>
        <label>
          <span className="fl">Country</span>
          <input
            value={draft.country}
            onChange={(e) => onChange({ country: e.target.value })}
          />
        </label>
        <label className="full">
          <span className="fl">Notes</span>
          <textarea
            className="dzp-ta"
            value={draft.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </label>
      </div>
      {error && (
        // :15433 — the old toast; the amber is the old overlap note's (:13831)
        <p className="dzp-mut" role="alert" style={{ color: 'var(--dzp-attn)', marginTop: 8 }}>
          {error}
        </p>
      )}
      <div className="dzp-acts">
        <button type="button" className="dzp-btn gho" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="dzp-btn pri" onClick={onSave} disabled={busy}>
          Save partner
        </button>
      </div>
    </div>
  );
}

/** `_matrix` (:15410-15418): one project's responsibility matrix + the
 * Darz card. The old head was `.dzp-head` (not ported — the desk owns its
 * heading), so the project name and "… · responsibility matrix" take the
 * desk's section heading recipe, with "Open project" beside them. */
function Matrix({
  p,
  lanes,
  nameOf,
}: {
  p: ProjectAdmin;
  lanes: PartnerLane[];
  nameOf: (orgId: string) => string;
}) {
  const ov = roleOverlaps(lanes); // :15411
  return (
    <div style={{ marginTop: 16 }}>
      <div className="ad-dsec-h" style={{ marginBottom: 8 }}>
        <h2 className="ad-dsec-t">{p.name || p.no}</h2>
        <span className="ad-dsec-n">
          {clientName(p) || 'No client'} · responsibility matrix
        </span>
        <Link
          className="dzp-btn sm"
          to={`/admin/projects/${p.id}`}
          style={{ marginLeft: 'auto' }}
        >
          Open project
        </Link>
      </div>
      <div className="dzp-mwrap">
        <table className="dzp-matrix">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Role</th>
              <th>Deliverables</th>
              <th>Ownership</th>
              <th>Channels</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {lanes.map((x, i) => {
              const warn = !!x.delivClass && ov.has(x.delivClass); // :15413
              return (
                <tr
                  key={`${x.orgId}-${i}`}
                  style={warn ? { background: 'var(--dzp-attnbg)' } : undefined}
                >
                  <td>
                    <b>{nameOf(x.orgId)}</b>
                  </td>
                  <td>{roleLabel(x.role)}</td>
                  <td>
                    {x.deliverables || '—'}
                    {x.delivClass && (
                      <>
                        <br />
                        <span className="dzp-mut">
                          {classLabel(x.delivClass)}
                          {warn ? ' · overlap' : ''}
                        </span>
                      </>
                    )}
                  </td>
                  <td>{x.ownership || '—'}</td>
                  <td>{x.channels || '—'}</td>
                  <td>
                    <span
                      className={`dzp-pill ${x.status === 'done' ? 'done' : x.status === 'at-risk' ? 'block' : 'active'}`}
                      style={{ fontSize: 9, padding: '3px 7px' }}
                    >
                      {x.status || 'on-track'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* :15418 */}
      <div className="dzp-darz">
        <div className="h">{DARZ_ROLE_MATRIX.h}</div>
        <p>{DARZ_ROLE_MATRIX.p}</p>
      </div>
    </div>
  );
}

/** :15398 — the worked example, the bold org names rendered as markup. */
function VanakCard() {
  return (
    <div className="dzp-darz">
      <div className="h">{VANAK_EXAMPLE.h}</div>
      <p>
        {VANAK_EXAMPLE.partners.map((x, i) => (
          <Fragment key={x.org}>
            {i > 0 ? ' · ' : ''}
            <b>{x.org}</b> — {x.role}
          </Fragment>
        ))}
        . <b>{VANAK_EXAMPLE.darz.org}</b> — {VANAK_EXAMPLE.darz.role}. {VANAK_EXAMPLE.note}
      </p>
    </div>
  );
}
