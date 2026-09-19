/**
 * PackagesPage — `/admin/projects/packages`, the package templates and the
 * shared service catalogue (`DZProjects.packages` / `_pkgCard` / `toggleSvc`
 * / `_svcPanel` / `editSvc` / `svcSet` / `saveSvc` / `delSvc`,
 * `darz-studio.html:13899-13948`; `delPackage` :13997; `applyPackage` /
 * `_doApplyPackage` / `_pickProject` / `_pickDone` :14000-14020) over
 * `GET|POST|PATCH|DELETE /projects/admin/packages/` and
 * `…/service-catalog/`, plus `PATCH …/projects/{id}/` for an apply.
 *
 * Ported content:
 *  - the heading, the sub (:13904) and the three header actions (:13905):
 *    the "Service catalogue" toggle, "＋ Custom proposal", "＋ New package";
 *  - one card per template (:13908-13916): name, purpose, the service
 *    lines ("2× name" / "No service lines."), the count chips (posts …
 *    "N min video"), one scope tag per service category (Included /
 *    Available as a paid addition, :13912), the owner-only money line
 *    (Cost · Min · Rec · Margin, :13911) and Proposal / Apply / Edit /
 *    Delete; the empty sentence (:13901);
 *  - the service catalogue panel (:13919-13929): "Service catalogue · N
 *    lines", "＋ Add service", one group per category with its count, each
 *    row name · unit, the money (cost · price for the owner, the price
 *    alone otherwise), Edit, ✕; the service editor's fields (:13938-13942)
 *    and its "Name the service" / "Service saved" lines (:13947); both
 *    confirms (:13948, :13997) verbatim;
 *  - applying a package (:14000-14016): the project pick, the patch
 *    `applyPackage` builds (:14002-14013), "Applied “name” to no" (:14014)
 *    and "No active projects yet. Create one first, then apply." (:14016).
 *
 * Mechanics that changed:
 *  - the templates are server-paginated (`Pager`); the catalogue is read
 *    whole (`per_page: 100`, `has_next` walked) because every card, the
 *    editor's menu and the calculator price from all of it;
 *  - the old modals are routes or inline blocks: the package editor is
 *    `/admin/projects/packages/new|:id` (`?custom=1` for the custom
 *    proposal), the service editor sits inside the panel, the project pick
 *    (:14017, a modal list) is an inline `<select>` under the card, and the
 *    toggle's `PKGV.svcOpen` lives in the URL (`?catalogue=1`);
 *  - a saved service carries its own `currency` (the backend has the
 *    field; the old rows priced everything in `projDefCur()`), so the
 *    editor has a Currency menu and a panel row shows its own currency,
 *    falling back to the default one. The cards keep the old
 *    default-currency money line (:13911);
 *  - "Proposal" on a card (:13916 `DZProjects.proposal(pkgId)` — the
 *    preview from a bare template, no project) has no desk here: the
 *    proposal is a section of the project record, so the button opens the
 *    card's own project pick with a note saying the proposal issues from
 *    the record it lands on — a stated redirect, not a dead button;
 *  - an apply is `PATCH …/projects/{id}/` with the optimistic lock; the
 *    old snapshot copy (`appliedPackage`, :14004) has no API field — the FK
 *    (`applied_package`) is the link, and a deleted template is tombstoned
 *    (`is_deleted`, filtered out of every read), so the delete confirm says
 *    what a project keeps here (its written deliverables and money) and
 *    what it loses (issuing a proposal), not the old "snapshot" line. A 409
 *    is the conflict banner with Reload; so is one on a service save;
 *  - `Lib.toast` lines are inline status notes; `dzConfirm` is
 *    `ConfirmDialog`.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ConflictError } from '../../../api/errors';
import { useApi, useOptions, useSession } from '../../../api/hooks';
import type { ProjectsAdminService } from '../../../api/services';
import type {
  Choice,
  PackageTemplateAdmin,
  PageQuery,
  Paginated,
  ProjectAdmin,
  ServiceCatalogItemAdmin,
  ServiceCatalogItemInput,
  ServiceCategory,
} from '../../../api/types';
import { ListController } from '../../shared/ListController';
import { useListController } from '../../shared/useListController';
import { asAdminRole } from '../adminNav';
import {
  ConfirmDialog,
  DeskAction,
  DeskBanner,
  DeskPage,
  Pager,
  deskBanner,
  resolveDeskView,
} from '../kit';
import {
  UNITS,
  applyPackage,
  asCounts,
  asInternal,
  asPackageLines,
  choices,
  defaultCurrency,
  projMoney,
  projN,
  scopeByCat,
  stageLabel,
  svcName,
} from './projectForm';
import '../admin.css';

const CONFLICT_PROJECT =
  'Someone else saved this project in the meantime — reload to continue.';
const CONFLICT_SERVICE =
  'Someone else saved this service in the meantime — reload to continue.';

class PackagesController extends ListController<PackageTemplateAdmin, PageQuery> {
  private readonly projects: ProjectsAdminService;
  constructor(projects: ProjectsAdminService) {
    super({});
    this.projects = projects;
  }
  protected fetchPage(query: PageQuery): Promise<Paginated<PackageTemplateAdmin>> {
    return this.projects.packages(query);
  }
}

/** The whole catalogue (`svcLoad()`, :13920) — the API pages it, 100 a page
 * at most, and every card needs every line to name its services. */
async function walkServices(api: ProjectsAdminService): Promise<ServiceCatalogItemAdmin[]> {
  const out: ServiceCatalogItemAdmin[] = [];
  let page = 1;
  for (;;) {
    const res = await api.services({ per_page: 100, page });
    out.push(...res.results);
    if (!res.pagination.has_next) return out;
    page += 1;
  }
}

/** Every non-archived project (:14016 `projLoad().filter(!archived)`) — the
 * API has no "active" list beyond `archived=False` (G-PROJ-1), so the pick
 * walks the set once, 100 a page. */
async function walkActive(api: ProjectsAdminService): Promise<ProjectAdmin[]> {
  const out: ProjectAdmin[] = [];
  let page = 1;
  for (;;) {
    const res = await api.projects({ archived: false, per_page: 100, page });
    out.push(...res.results);
    if (!res.pagination.has_next) return out;
    page += 1;
  }
}

/** `projClientName` (:13298): the linked org's name, else the typed one. */
function clientName(p: ProjectAdmin): string {
  return p.client_partner_org?.name || p.client_name || '';
}

interface ServiceGroup {
  cat: string;
  label: string;
  rows: ServiceCatalogItemAdmin[];
}

/** The catalogue per `projects.service_category`, in the option order
 * (:13921 `SVC_CATS.map`); a category the options do not list still shows
 * under its raw key, so no saved line is ever hidden. */
function groupByCategory(
  rows: ServiceCatalogItemAdmin[],
  categories: Choice[],
): ServiceGroup[] {
  const out: ServiceGroup[] = [];
  const seen = new Set<string>();
  for (const c of categories) {
    seen.add(c.value);
    const hit = rows.filter((x) => x.category === c.value);
    if (hit.length) out.push({ cat: c.value, label: c.label, rows: hit });
  }
  for (const x of rows) {
    const cat = x.category ?? '';
    if (seen.has(cat)) continue;
    seen.add(cat);
    out.push({
      cat,
      label: cat || 'Uncategorised',
      rows: rows.filter((y) => (y.category ?? '') === cat),
    });
  }
  return out;
}

/** `_svcDraft` (:13932) — the row being edited, its money as typed. */
interface ServiceDraft {
  id: string | null;
  version: number;
  name: string;
  category: string;
  unit: string;
  internal_cost: string;
  price: string;
  currency: string;
}

/** A walk the pick can tell apart from a stale one (`key` vs its `gen`). */
interface Walk<T> {
  key: number;
  rows: T[] | null;
  error: string | null;
}

/** Which button opened a card's project pick (:13916 — Proposal or Apply). */
type PickVia = 'apply' | 'proposal';

/* :13929 — the panel head's label carried its own inline style */
const PANEL_LABEL = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: 'var(--ink3)',
} as const;

export function PackagesPage() {
  const { projectsAdmin } = useApi();
  const options = useOptions();
  const { me } = useSession();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const canMoney = asAdminRole(me?.role) === 'owner'; // projCanMoney(), :13282

  const categories = choices(options, 'projects.service_category');
  const currencies = choices(options, 'currency');
  const cur = defaultCurrency(options); // projDefCur(), :13287
  const svcOpen = params.get('catalogue') === '1'; // PKGV.svcOpen (:13902)

  const { state, setPage, reload } = useListController<PackageTemplateAdmin, PageQuery>(
    () => new PackagesController(projectsAdmin),
  );

  // the catalogue — walked whole, re-walked after every service save/remove
  const [svcGen, setSvcGen] = useState(0);
  const [svcWalk, setSvcWalk] = useState<{
    rows: ServiceCatalogItemAdmin[] | null;
    error: string | null;
  }>({ rows: null, error: null });
  useEffect(() => {
    let alive = true;
    walkServices(projectsAdmin).then(
      (rows) => alive && setSvcWalk({ rows, error: null }),
      (err: unknown) =>
        alive &&
        setSvcWalk({
          rows: null,
          error: err instanceof Error ? err.message : 'Could not load the service catalogue.',
        }),
    );
    return () => {
      alive = false;
    };
  }, [projectsAdmin, svcGen]);
  // the last rows stay on screen while a re-walk is in flight
  const catalogue = svcWalk.rows ?? [];
  const svcLoading = svcWalk.rows === null && !svcWalk.error;

  const [svcDraft, setSvcDraft] = useState<ServiceDraft | null>(null);
  const [svcError, setSvcError] = useState<string | null>(null);
  const [svcConflict, setSvcConflict] = useState(false);
  const [removingSvc, setRemovingSvc] = useState<ServiceCatalogItemAdmin | null>(null);
  const [removingPkg, setRemovingPkg] = useState<PackageTemplateAdmin | null>(null);
  // the one card whose project pick is open, and which button opened it
  const [applying, setApplying] = useState<{ id: string; via: PickVia } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** `toggleSvc` (:13918) — the open state lives in the URL. */
  const setOpen = (on: boolean) => {
    const next = new URLSearchParams(params);
    if (on) next.set('catalogue', '1');
    else next.delete('catalogue');
    setParams(next, { replace: true });
  };

  /** `editSvc` (:13931-13932): a copy of the row, or the blank draft
   * (category = the first choice, unit piece, 0 / 0 — the old literals). */
  const editSvc = (row: ServiceCatalogItemAdmin | null) => {
    setSvcError(null);
    setSvcConflict(false);
    setSvcDraft(
      row
        ? {
            id: row.id,
            version: row.version,
            name: row.name,
            category: row.category ?? '',
            unit: row.unit || 'piece',
            internal_cost: row.internal_cost ?? '',
            price: row.price ?? '',
            currency: row.currency || cur,
          }
        : {
            id: null,
            version: 0,
            name: '',
            category: categories[0]?.value ?? '',
            unit: 'piece',
            internal_cost: '0',
            price: '0',
            currency: cur,
          },
    );
  };

  /** `svcSet` (:13946) — the money fields are normalised on save, not here,
   * so a decimal can be typed in full. */
  const svcSet = (patch: Partial<ServiceDraft>) =>
    setSvcDraft((d) => (d ? { ...d, ...patch } : d));

  /** `saveSvc` (:13947). */
  const saveSvc = async () => {
    if (!svcDraft || busy) return;
    if (!svcDraft.name.trim()) {
      setSvcError('Name the service'); // :13947
      return;
    }
    setBusy(true);
    setSvcError(null);
    setSvcConflict(false);
    setNote(null);
    const body: ServiceCatalogItemInput = {
      name: svcDraft.name.trim(),
      unit: svcDraft.unit,
      price: String(projN(svcDraft.price)),
    };
    if (svcDraft.category) body.category = svcDraft.category as ServiceCategory;
    if (svcDraft.currency)
      body.currency = svcDraft.currency as ServiceCatalogItemInput['currency'];
    // the internal cost is the owner's field (:13941) — a standard admin's
    // save never carries it, so the stored value survives their edit
    if (canMoney) body.internal_cost = String(projN(svcDraft.internal_cost));
    try {
      if (svcDraft.id)
        await projectsAdmin.updateService(svcDraft.id, {
          ...body,
          expected_version: svcDraft.version,
        });
      else await projectsAdmin.createService(body);
      setSvcDraft(null);
      setSvcGen((g) => g + 1);
      setOpen(true); // PKGV.svcOpen = true (:13947)
      setNote('Service saved'); // :13947
    } catch (err: unknown) {
      if (err instanceof ConflictError) setSvcConflict(true);
      else setSvcError(err instanceof Error ? err.message : 'Could not save the service.');
    } finally {
      setBusy(false);
    }
  };

  /** `delSvc` (:13948), after the confirm. */
  const removeSvc = async (row: ServiceCatalogItemAdmin) => {
    setActionError(null);
    try {
      await projectsAdmin.deleteService(row.id);
      setSvcGen((g) => g + 1);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Could not remove the service.');
    }
  };

  /** `delPackage` (:13997), after the confirm. */
  const removePkg = async (p: PackageTemplateAdmin) => {
    setActionError(null);
    try {
      await projectsAdmin.deletePackage(p.id);
      await reload();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Could not delete the package.');
    }
  };

  /** `_doApplyPackage` (:14002-14014) for one card — the pick calls it with
   * the moment of the click, which stamps the new deliverable/payment ids. */
  const applyTo =
    (pkg: PackageTemplateAdmin) => async (project: ProjectAdmin, now: number) => {
      // the deliverable texts are the services' names (:14006) — never apply
      // over a catalogue that has not arrived, or every line reads "(removed service)"
      if (svcWalk.rows === null)
        throw new Error('The service catalogue has not loaded yet — try again in a moment.');
      const patch = applyPackage(project, pkg, catalogue, cur, now);
      const saved = await projectsAdmin.updateProject(project.id, {
        ...patch,
        expected_version: project.version,
      });
      return (
        // :14014 — the toast, plus the record it then opened
        <>
          Applied “{pkg.name || 'package'}” to {saved.no} ·{' '}
          <Link to={`/admin/projects/${saved.id}`}>Open the record</Link>
        </>
      );
    };

  const view = resolveDeskView(state.status, state.results.length);
  const banner = deskBanner(state.status, state.error, actionError);
  const groups = groupByCategory(catalogue, categories);

  return (
    <DeskPage
      title="Packages"
      action={
        // :13905 — the old `.dzp-hacts` row; the "＋" buttons take the desk's own action shape
        <div className="dzp-acts" style={{ marginTop: 0 }}>
          <button
            type="button"
            className={`dzp-tog${svcOpen ? ' on' : ''}`}
            aria-pressed={svcOpen}
            onClick={() => setOpen(!svcOpen)}
          >
            Service catalogue
          </button>
          <DeskAction onClick={() => navigate('/admin/projects/packages/new?custom=1')}>
            ＋ Custom proposal
          </DeskAction>
          <DeskAction onClick={() => navigate('/admin/projects/packages/new')}>
            ＋ New package
          </DeskAction>
        </div>
      }
    >
      {/* :13904 */}
      <p className="ad-desksub">
        One shared service catalogue feeds every package, the calculator and curatorial
        pricing. Apply a package to a project as an editable snapshot — the template stays
        pristine.
      </p>

      <div className="dzp">
        {banner && <DeskBanner>{banner}</DeskBanner>}
        {svcWalk.error && <DeskBanner>{svcWalk.error}</DeskBanner>}
        {note && (
          <p className="dzp-mut" role="status">
            {note}
          </p>
        )}

        {view === 'loading' && <p className="dz-state">Loading…</p>}
        {view === 'empty' && (
          <div className="dzp-pkgs">
            {/* :13901 */}
            <div className="dzp-empty" style={{ gridColumn: '1 / -1' }}>
              No package templates yet. Create one from the shared service catalogue.
            </div>
          </div>
        )}
        {view === 'rows' && (
          <div className="dzp-pkgs">
            {state.results.map((p) => (
              <PackageCard
                key={p.id}
                p={p}
                catalogue={catalogue}
                categories={categories}
                canMoney={canMoney}
                cur={cur}
                applying={applying?.id === p.id ? applying.via : null}
                onApplyToggle={(via) =>
                  setApplying(
                    applying?.id === p.id && applying.via === via ? null : { id: p.id, via },
                  )
                }
                onPick={applyTo(p)}
                onCancelPick={() => setApplying(null)}
                onDelete={() => setRemovingPkg(p)}
              />
            ))}
          </div>
        )}
        {state.pagination && <Pager pagination={state.pagination} onPage={setPage} />}

        {/* :13919-13929 `_svcPanel` */}
        {svcOpen && (
          <div className="dzp-panel">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '11px 0',
              }}
            >
              <div className="fl" style={PANEL_LABEL}>
                Service catalogue · {catalogue.length} lines
              </div>
              <button type="button" className="dzp-btn sm" onClick={() => editSvc(null)}>
                ＋ Add service
              </button>
            </div>

            {/* :13936-13944 `editSvc` — the modal's form, inline in the panel */}
            {svcDraft && (
              <div className="dzp-svcgrp">
                <div className="gh">
                  Service catalogue · {svcDraft.id ? 'Edit service' : 'New service'}
                </div>
                {svcConflict && (
                  <DeskBanner>
                    {CONFLICT_SERVICE}{' '}
                    <button
                      type="button"
                      className="dzp-btn sm"
                      onClick={() => {
                        setSvcConflict(false);
                        setSvcDraft(null);
                        setSvcGen((g) => g + 1);
                      }}
                    >
                      Reload
                    </button>
                  </DeskBanner>
                )}
                {svcError && <DeskBanner>{svcError}</DeskBanner>}
                <div className="dzp-form">
                  <label className="full">
                    <span className="fl">Service name</span>
                    <input
                      value={svcDraft.name}
                      onChange={(e) => svcSet({ name: e.target.value })}
                    />
                  </label>
                  <label>
                    <span className="fl">Category</span>
                    <select
                      value={svcDraft.category}
                      onChange={(e) => svcSet({ category: e.target.value })}
                    >
                      {categories.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="fl">Unit</span>
                    <select
                      value={svcDraft.unit}
                      onChange={(e) => svcSet({ unit: e.target.value })}
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </label>
                  {canMoney && (
                    <label>
                      <span className="fl">Internal cost</span>
                      <input
                        inputMode="decimal"
                        value={svcDraft.internal_cost}
                        onChange={(e) => svcSet({ internal_cost: e.target.value })}
                      />
                    </label>
                  )}
                  <label>
                    <span className="fl">Price</span>
                    <input
                      inputMode="decimal"
                      value={svcDraft.price}
                      onChange={(e) => svcSet({ price: e.target.value })}
                    />
                  </label>
                  {/* the backend's own field — the old editor had none (every
                      row priced in `projDefCur()`) */}
                  <label>
                    <span className="fl">Currency</span>
                    <select
                      value={svcDraft.currency}
                      onChange={(e) => svcSet({ currency: e.target.value })}
                    >
                      {currencies.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {/* :13944 */}
                <div className="dzp-acts">
                  <button
                    type="button"
                    className="dzp-btn gho"
                    disabled={busy}
                    onClick={() => setSvcDraft(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="dzp-btn pri"
                    disabled={busy}
                    onClick={() => void saveSvc()}
                  >
                    Save service
                  </button>
                </div>
              </div>
            )}

            {svcLoading && <p className="dz-state">Loading…</p>}
            {/* :13921-13928 — one group per category, `label · n` */}
            {groups.map((g) => (
              <div className="dzp-svcgrp" key={g.cat}>
                <div className="gh">
                  {g.label} · {g.rows.length}
                </div>
                {g.rows.map((x) => (
                  <div className="dzp-line" key={x.id}>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--ink)' }}>
                      {x.name} <span className="dzp-mut">· {x.unit || 'piece'}</span>
                    </span>
                    <span className="dzp-mut" style={{ flex: '0 0 auto' }}>
                      {canMoney
                        ? `cost ${projMoney(x.internal_cost, x.currency || cur)} · ${projMoney(x.price, x.currency || cur)}`
                        : projMoney(x.price, x.currency || cur)}
                    </span>
                    <button
                      type="button"
                      className="dzp-btn sm gho"
                      onClick={() => editSvc(x)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="dzp-btn sm gho dgr"
                      aria-label={`Remove ${x.name}`}
                      onClick={() => setRemovingSvc(x)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {removingPkg && (
        // :13997 read "Projects it was applied to keep their snapshot." —
        // this API keeps no copy (`applied_package` is a bare FK and the
        // delete tombstones the row, `PackageTemplateService.soft_delete`),
        // so the confirm promises only what a project really keeps here
        <ConfirmDialog
          message="Delete this package template? Projects it was applied to keep the deliverables and money already written to them, but can no longer issue a proposal from it."
          okLabel="Delete"
          danger
          onCancel={() => setRemovingPkg(null)}
          onConfirm={() => {
            const p = removingPkg;
            setRemovingPkg(null);
            void removePkg(p);
          }}
        />
      )}
      {removingSvc && (
        // :13948
        <ConfirmDialog
          message="Remove this service line from the catalogue?"
          okLabel="Remove"
          danger
          onCancel={() => setRemovingSvc(null)}
          onConfirm={() => {
            const x = removingSvc;
            setRemovingSvc(null);
            void removeSvc(x);
          }}
        />
      )}
    </DeskPage>
  );
}

const COUNT_CHIPS: Array<[keyof ReturnType<typeof asCounts>, string]> = [
  ['posts', 'posts'],
  ['stories', 'stories'],
  ['articles', 'articles'],
  ['interviews', 'interviews'],
  ['photos', 'photos'],
  ['videos', 'videos'],
]; // :13910

/** `_pkgCard` (:13908-13916). */
function PackageCard({
  p,
  catalogue,
  categories,
  canMoney,
  cur,
  applying,
  onApplyToggle,
  onPick,
  onCancelPick,
  onDelete,
}: {
  p: PackageTemplateAdmin;
  catalogue: ServiceCatalogItemAdmin[];
  categories: Choice[];
  canMoney: boolean;
  cur: string;
  applying: PickVia | null;
  onApplyToggle: (via: PickVia) => void;
  onPick: (project: ProjectAdmin, now: number) => Promise<ReactNode>;
  onCancelPick: () => void;
  onDelete: () => void;
}) {
  const lines = asPackageLines(p.lines);
  const c = asCounts(p.counts);
  const it = asInternal(p.internal);
  const cnt: string[] = [];
  for (const [k, lbl] of COUNT_CHIPS) if (c[k] > 0) cnt.push(`${c[k]} ${lbl}`);
  if (c.videoMin > 0) cnt.push(`${c.videoMin} min video`);
  const scope = scopeByCat(lines, catalogue, categories); // :13912

  return (
    <div className="dzp-pkg">
      <div className="pn">{p.name || 'Package'}</div>
      <div className="pp">{p.purpose || ''}</div>
      {/* :13909 */}
      <div className="pl">
        {lines.length ? (
          lines.map((l, i) => (
            <div key={`${l.svcId}-${i}`}>
              <b>{l.count > 1 ? `${l.count}× ` : ''}</b>
              {svcName(catalogue, l.svcId)}
            </div>
          ))
        ) : (
          <div className="dzp-mut">No service lines.</div>
        )}
      </div>
      {/* :13910, :13914 */}
      {cnt.length > 0 && (
        <div className="dzp-cnt">
          {cnt.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      {/* :13912, :13915 — every category is Included or a paid addition */}
      <div className="dzp-cnt" style={{ marginTop: 2 }}>
        {scope.map((s) => (
          <span
            key={s.cat}
            className={`dzp-tag ${s.included ? 'inc' : 'add'}`}
            title={s.included ? 'Included' : 'Available as a paid addition'}
          >
            {s.label}
          </span>
        ))}
      </div>
      {/* :13911 — owner only, in the default currency */}
      {canMoney && (
        <div className="pm">
          Cost <b>{projMoney(it.internalCost + it.externalCost, cur)}</b> · Min{' '}
          <b>{projMoney(it.minFee, cur)}</b> · Rec <b>{projMoney(it.recFee, cur)}</b> · Margin{' '}
          <b>{it.targetMargin}%</b>
        </div>
      )}
      {/* :13916 — `DZProjects.proposal(pkgId)` previewed the bare template;
          here a proposal issues from a project's record, so Proposal opens
          the same pick as Apply and the note under it says why */}
      <div className="dzp-acts">
        <button
          type="button"
          className="dzp-btn sm pri"
          aria-expanded={applying === 'proposal'}
          onClick={() => onApplyToggle('proposal')}
        >
          Proposal
        </button>
        <button
          type="button"
          className="dzp-btn sm"
          aria-expanded={applying === 'apply'}
          onClick={() => onApplyToggle('apply')}
        >
          Apply
        </button>
        <Link className="dzp-btn sm" to={`/admin/projects/packages/${p.id}`}>
          Edit
        </Link>
        <button type="button" className="dzp-btn sm gho dgr" onClick={onDelete}>
          Delete
        </button>
      </div>
      {applying === 'proposal' && (
        // stated redirect — the record the apply lands on has the Proposal section
        <p className="dzp-mut" role="note" style={{ marginTop: 10 }}>
          Proposal · apply the package to a project first; the proposal issues from that
          project’s record.
        </p>
      )}
      {applying && (
        <ProjectPick
          prompt={`Apply “${p.name || 'package'}” to which project?`} // :14000
          actionLabel="Apply"
          onPick={onPick}
          onCancel={onCancelPick}
        />
      )}
    </div>
  );
}

/**
 * `_pickProject` / `_pickDone` (:14016-14020) — the "which project?" step
 * every apply and the calculator's save share, as an inline block instead
 * of the old modal list: the active projects in a `<select>` (name — client
 * · stage, the old row's three facts, :14017), the action, Cancel. `onPick`
 * gets the project and the moment of the click (the `now` the ids of new
 * deliverables / payments are stamped with, :14006 / :14012), does the
 * write and returns the status line that then takes the block's place; a
 * 409 from it is the conflict banner with Reload (the list is re-read so
 * the next try carries fresh versions).
 */
export function ProjectPick({
  prompt,
  actionLabel,
  onPick,
  onCancel,
}: {
  prompt: string;
  actionLabel: string;
  onPick: (project: ProjectAdmin, now: number) => Promise<ReactNode>;
  onCancel: () => void;
}) {
  const { projectsAdmin } = useApi();
  const options = useOptions();
  const stages = choices(options, 'projects.stage');
  const [gen, setGen] = useState(0);
  const [walk, setWalk] = useState<Walk<ProjectAdmin>>({ key: -1, rows: null, error: null });
  const [picked, setPicked] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [done, setDone] = useState<ReactNode>(null);

  useEffect(() => {
    let alive = true;
    walkActive(projectsAdmin).then(
      (rows) => alive && setWalk({ key: gen, rows, error: null }),
      (err: unknown) =>
        alive &&
        setWalk({
          key: gen,
          rows: null,
          error: err instanceof Error ? err.message : 'Could not load the projects.',
        }),
    );
    return () => {
      alive = false;
    };
  }, [projectsAdmin, gen]);

  // a walk for another key is stale — the list is loading again
  const current = walk.key === gen ? walk : null;
  const rows = current?.rows ?? null;

  const go = async () => {
    const p = rows?.find((r) => r.id === picked);
    if (!p || busy) return;
    setBusy(true);
    setError(null);
    setConflict(false);
    try {
      setDone(await onPick(p, Date.now()));
    } catch (err: unknown) {
      if (err instanceof ConflictError) setConflict(true);
      else setError(err instanceof Error ? err.message : 'That did not go through.');
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <p className="dzp-mut" role="status">
        {done}
      </p>
    );

  return (
    <div style={{ marginTop: 10 }}>
      <div className="dzp-fl">{prompt}</div>
      {conflict && (
        <DeskBanner>
          {CONFLICT_PROJECT}{' '}
          <button
            type="button"
            className="dzp-btn sm"
            onClick={() => {
              setConflict(false);
              setGen((g) => g + 1);
            }}
          >
            Reload
          </button>
        </DeskBanner>
      )}
      {error && <DeskBanner>{error}</DeskBanner>}
      {current?.error && <DeskBanner>{current.error}</DeskBanner>}
      {!current && <p className="dz-state">Loading…</p>}
      {rows && rows.length === 0 && (
        // :14016
        <p className="dzp-mut" role="status">
          No active projects yet. Create one first, then apply.{' '}
          <Link to="/admin/projects/new">＋ New project</Link>
        </p>
      )}
      {rows && rows.length > 0 && (
        <div className="dzp-acts" style={{ marginTop: 0 }}>
          <select
            className="dzp-sel"
            aria-label="Project"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
          >
            <option value="">— pick a project —</option>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {`${r.name || 'Untitled'} — ${clientName(r) || 'No client'} · ${stageLabel(stages, r.stage)}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="dzp-btn sm pri"
            disabled={!picked || busy}
            onClick={() => void go()}
          >
            {actionLabel}
          </button>
          <button type="button" className="dzp-btn sm gho" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
