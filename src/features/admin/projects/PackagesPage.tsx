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
 *  - "＋ Add the standard set" (owner only, the panel's `StandardSetCard`)
 *    writes Darz's REAL catalogue by an explicit click, through the ordinary
 *    create endpoints, skipping by name anything already there: the
 *    exhibition services with their real Toman prices, the coverage
 *    services (unpriced — Darz quotes them per show) in their five
 *    programmes, and the four checklist templates (the data and the plan
 *    live in `standardSet.ts`, which every count on the card is read from).
 *    The old panel's `projSeedIfEmpty` demo rates (:13386-13433) are NOT
 *    what this writes any more — their USD prices were invented for a demo
 *    and reached clients through the calculator and the proposal, so the
 *    owner ruled them out; only the checklists stayed. The card says on the
 *    spot what does not come across: the Toman prices and what a workspace
 *    without TMN gets instead, no internal costs, no "on request" (an
 *    unpriced line is written as 0), descriptions only (G-PROJ-8 — no
 *    flow / timing / needs), and the
 *    pairs the owner ruled are one service, and any row a merge superseded
 *    that this workspace still holds;
 *  - `Lib.toast` lines are inline status notes; `dzConfirm` is
 *    `ConfirmDialog`.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ConflictError } from '../../../api/errors';
import { useApi, useOptions, useSession } from '../../../api/hooks';
import type { ProjectsAdminService } from '../../../api/services';
import type {
  ChecklistTemplateAdmin,
  Choice,
  PackageTemplateAdmin,
  PackageTemplatePatch,
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
  ConflictBanner,
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
  choiceLabel,
  choices,
  clientName,
  defaultCurrency,
  projMoney,
  projN,
  scopeByCat,
  stageLabel,
  svcName,
  walkPages,
  walkProjects,
  walkServices,
} from './projectForm';
import {
  MERGED_SERVICES,
  supersededRows,
  STANDARD_CURRENCY,
  STANDARD_SET_COUNTS,
  checklistInput,
  missingServices,
  packageInput,
  planChecklists,
  planPackages,
  planServices,
  serviceIdIndex,
  serviceInput,
} from './standardSet';
import { describeTidy, hasWork, planTidy } from './tidyUp';
import '../admin.css';

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
  // the standard set's own card — one inline editor slot, so opening it puts
  // the service editor away and vice versa
  const [stdOpen, setStdOpen] = useState(false);
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
    setStdOpen(false);
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
      subtitle={
        /* :13904 */
        <>
          One shared service catalogue feeds every package, the calculator and curatorial
          pricing. Apply a package to a project as an editable snapshot — the template stays
          pristine.
        </>
      }
    >
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
              <div className="dzp-acts" style={{ marginTop: 0 }}>
                {/* Darz's real catalogue on an explicit click, where the old
                    panel seeded itself silently (`projSeedIfEmpty`,
                    :13381-13451) — owner only, because it writes prices into
                    the shared catalogue (`projCanMoney()`, :13282) */}
                {canMoney && (
                  <button
                    type="button"
                    className="dzp-btn sm"
                    aria-expanded={stdOpen}
                    onClick={() => {
                      setSvcDraft(null);
                      setStdOpen(!stdOpen);
                    }}
                  >
                    ＋ Add the standard set
                  </button>
                )}
                <button type="button" className="dzp-btn sm" onClick={() => editSvc(null)}>
                  ＋ Add service
                </button>
              </div>
            </div>

            {canMoney && stdOpen && (
              <StandardSetCard
                onCancel={() => setStdOpen(false)}
                onDone={() => {
                  // the panel's list and the package grid re-read, so the new
                  // rows are simply there behind the card's report
                  setSvcGen((g) => g + 1);
                  void reload();
                }}
              />
            )}

            {/* :13936-13944 `editSvc` — the modal's form, inline in the panel */}
            {svcDraft && (
              <div className="dzp-svcgrp">
                <div className="gh">
                  Service catalogue · {svcDraft.id ? 'Edit service' : 'New service'}
                </div>
                {svcConflict && (
                  <ConflictBanner
                    noun="service"
                    reloadClassName="dzp-btn sm"
                    onReload={() => {
                      setSvcConflict(false);
                      setSvcDraft(null);
                      setSvcGen((g) => g + 1);
                    }}
                  />
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
                    {/* A line Darz has not priced yet stores 0, and "0 TMN"
                        reads as free — it is not, it is unquoted. Say which
                        (the same rule the programme cards follow). The
                        internal cost keeps its figure: 0 cost is a real
                        statement, and the card above says none is recorded. */}
                    <span className="dzp-mut" style={{ flex: '0 0 auto' }}>
                      {projN(x.price) > 0
                        ? canMoney
                          ? `cost ${projMoney(x.internal_cost, x.currency || cur)} · ${projMoney(x.price, x.currency || cur)}`
                          : projMoney(x.price, x.currency || cur)
                        : 'not priced yet'}
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
      {/* :13911 — owner only, in the default currency. A template with no
          figures at all (every standard programme starts that way: Darz
          quotes them) prints no money line rather than four zeroes under a
          currency it was never priced in — the desk's default is not the
          catalogue's, and "0 USD" on a Toman catalogue reads as a claim. */}
      {canMoney &&
        (it.internalCost || it.externalCost || it.minFee || it.recFee ? (
          <div className="pm">
            Cost <b>{projMoney(it.internalCost + it.externalCost, cur)}</b> · Min{' '}
            <b>{projMoney(it.minFee, cur)}</b> · Rec <b>{projMoney(it.recFee, cur)}</b> ·
            Margin <b>{it.targetMargin}%</b>
          </div>
        ) : (
          <div className="pm">No fee set — quoted per show.</div>
        ))}
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

/* ── the standard set (Darz's real services, `standardSet.ts`) ──────────── */

/** The three kinds the card ticks, in the order it lists and writes them. */
type SeedKind = 'services' | 'packages' | 'checklists';

const SEED_KINDS: SeedKind[] = ['services', 'packages', 'checklists'];

/** Singular / plural, so every count reads as a sentence rather than a
 * table ("1 service line", "4 checklist templates"). */
const SEED_NOUNS: Record<SeedKind, [string, string]> = {
  services: ['service line', 'service lines'],
  packages: ['package template', 'package templates'],
  checklists: ['checklist template', 'checklist templates'],
};

/** The preview row's heading. */
const SEED_TITLES: Record<SeedKind, string> = {
  services: 'Service lines',
  packages: 'Package templates',
  checklists: 'Checklist templates',
};

function countText(kind: SeedKind, n: number): string {
  const [one, many] = SEED_NOUNS[kind];
  return `${n} ${n === 1 ? one : many}`;
}

/** The merged-pairs paragraph's opening, counted rather than written out, so
 * it can never disagree with the list under it. */
function mergedLead(n: number): string {
  return n === 1
    ? 'One coverage line and one exhibition service are the same service'
    : `${n} coverage lines name the same service as a priced exhibition line`;
}

/** "a, b and c". */
function joinWords(parts: string[]): string {
  if (parts.length < 2) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** The tick labels — every count comes from the data module, never typed out
 * here. The service lines are named plainly: the notes below the ticks are
 * where the card says how many of them arrive unpriced, and a tick that
 * promised a "rate card" would contradict them. */
const SEED_TICKS: Record<SeedKind, string> = {
  services: countText('services', STANDARD_SET_COUNTS.services),
  packages: countText('packages', STANDARD_SET_COUNTS.packages),
  checklists: countText('checklists', STANDARD_SET_COUNTS.checklists),
};

type SeedTicks = Record<SeedKind, boolean>;
type SeedCounts = Record<SeedKind, number>;

/** A package left uncreated because the catalogue has no row for one of its
 * lines — `packageInput` would drop that line silently. */
interface ShortPackage {
  name: string;
  missing: string[];
}

interface SeedStep {
  label: string;
  done: number;
  /** 0 for a step with nothing to count (the catalogue re-read). */
  total: number;
}

interface SeedReport {
  added: SeedCounts;
  skipped: SeedCounts;
  short: ShortPackage[];
  /** The failure that stopped the run; null when it ran to the end. */
  error: string | null;
}

/** "Added 3 service lines and 1 package template, skipped 27 service lines
 * already there." — exact counts, per kind. */
function resultText(r: SeedReport): string {
  const added = SEED_KINDS.filter((k) => r.added[k] > 0).map((k) => countText(k, r.added[k]));
  const skipped = SEED_KINDS.filter((k) => r.skipped[k] > 0).map((k) =>
    countText(k, r.skipped[k]),
  );
  if (!added.length)
    return skipped.length
      ? `Nothing new to add — ${joinWords(skipped)} already there.`
      : 'Nothing was added.';
  const tail = skipped.length ? `, skipped ${joinWords(skipped)} already there.` : '.';
  return `Added ${joinWords(added)}${tail}`;
}

/** Nothing is rolled back, so a failure says exactly what did get written. */
function failureText(r: SeedReport): string {
  const added = SEED_KINDS.filter((k) => r.added[k] > 0).map((k) => countText(k, r.added[k]));
  return added.length
    ? `Nothing was rolled back; added before it stopped: ${joinWords(added)}.`
    : 'Nothing was added, and nothing was rolled back.';
}

/**
 * Darz's real catalogue written by an explicit, idempotent, owner-only action
 * — never the silent first-open seed the old panel did (`projSeedIfEmpty`,
 * :13381-13451), which a server DB must not: the exhibition services with
 * their real Toman prices, the coverage services in their five programmes and
 * the four checklist templates (`standardSet.ts`), through the ordinary create
 * endpoints wherever the admin is signed in. Every plan skips by NAME
 * (trimmed, case-insensitive), so nothing is duplicated or overwritten and a
 * run that stopped half-way is resumed by pressing the button again.
 *
 * Every number the card states — how many lines, how many of them unpriced,
 * which pairs look alike — is read from `standardSet.ts`, never typed here, so
 * the copy cannot outlive the data it describes.
 *
 * The packages are written after the catalogue is re-read, because a template
 * links its lines by the id the API hands back; one whose line is missing is
 * named in the report instead of being created short of its scope.
 */
function StandardSetCard({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const { projectsAdmin } = useApi();
  const options = useOptions();
  const [tick, setTick] = useState<SeedTicks>({
    services: true,
    packages: true,
    checklists: true,
  });
  const [gen, setGen] = useState(0);
  // The card reads all THREE lists itself, under one key. The panel has its
  // own catalogue walk, but a plan must never mix a fresh read of one list
  // with a stale read of another: after a run both the panel's walk and this
  // one are in flight, and a plan built on the pre-run catalogue would offer
  // to create everything a second time. `key === gen` is the whole test
  // (the `Walk<T>` pattern of `ProjectPick`, :190).
  const [tpl, setTpl] = useState<{
    key: number;
    services: ServiceCatalogItemAdmin[] | null;
    packages: PackageTemplateAdmin[] | null;
    checklists: ChecklistTemplateAdmin[] | null;
    error: string | null;
  }>({ key: -1, services: null, packages: null, checklists: null, error: null });
  const [step, setStep] = useState<SeedStep | null>(null);
  const [report, setReport] = useState<SeedReport | null>(null);
  const [busy, setBusy] = useState(false);
  /** What the tidy is doing, while it does it. '' when it is not running. */
  const [tidying, setTidying] = useState('');

  // all three lists are read WHOLE (each is server-paginated, and a name
  // already there on page 3 must still be skipped)
  useEffect(() => {
    let alive = true;
    Promise.all([
      walkServices(projectsAdmin),
      walkPages((page) => projectsAdmin.packages({ page, per_page: 100 })),
      walkPages((page) => projectsAdmin.checklists({ page, per_page: 100 })),
    ]).then(
      ([services, packages, checklists]) =>
        alive && setTpl({ key: gen, services, packages, checklists, error: null }),
      (err: unknown) =>
        alive &&
        setTpl({
          key: gen,
          services: null,
          packages: null,
          checklists: null,
          error: err instanceof Error ? err.message : 'Could not read what is already there.',
        }),
    );
    return () => {
      alive = false;
    };
  }, [projectsAdmin, gen]);

  // TMN — the owner's decision: Darz prices Iranian galleries in Toman, and
  // international galleries are quoted in USD or EUR later, chosen at the
  // time. Used when this backend serves it; the served list decides, so the
  // enum is never assumed (a workspace without TMN gets the same numbers in
  // its default currency, and the card says so)
  const currencies = choices(options, 'currency');
  // the served label ("Iranian Toman"), never a lookup typed in this repo;
  // `choiceLabel` falls back to the code for a currency this workspace has no
  // option for — which is exactly the case the second note below describes
  const currencyWord = (c: string) => choiceLabel(currencies, c);
  // “Iranian Toman (TMN)”, or the bare code when the served list carries no
  // label of its own — so the sentence never reads “TMN (TMN)”
  const currencyName = (c: string) => {
    const word = currencyWord(c);
    return word && word !== c ? `${word} (${c})` : c;
  };
  const seedCurrency = currencies.some((c) => c.value === STANDARD_CURRENCY)
    ? STANDARD_CURRENCY
    : defaultCurrency(options) || STANDARD_CURRENCY;
  const priced = STANDARD_SET_COUNTS.services - STANDARD_SET_COUNTS.unpriced;

  // a plan is only shown when every list in it came back from THIS read
  const fresh = tpl.key === gen;
  // lines a merge superseded that THIS workspace still holds (a seed run
  // before the 2026-09-19 ruling wrote both sides); read from the same fresh
  // walk, so it can never be named off a stale catalogue
  const stale = supersededRows(fresh ? (tpl.services ?? []) : []);
  // the two-step plan behind "Tidy them up", from the same fresh walk
  const tidy = planTidy(fresh ? (tpl.services ?? []) : [], fresh ? (tpl.packages ?? []) : []);
  const plans = {
    services: planServices(fresh ? (tpl.services ?? []) : []),
    packages: planPackages(fresh ? (tpl.packages ?? []) : []),
    checklists: planChecklists(fresh ? (tpl.checklists ?? []) : []),
  };
  const ready =
    fresh &&
    options !== null &&
    tpl.services !== null &&
    tpl.packages !== null &&
    tpl.checklists !== null;

  // a package is only creatable once every line it names can be resolved —
  // against the catalogue as it will be when the run reaches the packages,
  // so the lines this run would add count too. One that cannot is shown as
  // waiting on its lines, not as "to add", because the run refuses to write
  // a template short of its scope
  const plannedIndex = serviceIdIndex([
    ...(tpl.services ?? []),
    ...(tick.services
      ? plans.services.create.map((s, i) => ({ id: `planned-${i}`, name: s.name }))
      : []),
  ]);
  const shortPackages = plans.packages.create.filter(
    (p) => missingServices(p, plannedIndex).length > 0,
  );
  const creatable = {
    services: plans.services.create.length,
    packages: plans.packages.create.length - shortPackages.length,
    checklists: plans.checklists.create.length,
  };
  const toAdd = SEED_KINDS.reduce((n, k) => n + (tick[k] ? creatable[k] : 0), 0);

  const toggle = (k: SeedKind, on: boolean) =>
    setTick((t) => {
      const next = { ...t };
      next[k] = on;
      return next;
    });

  /** Sequential — there is no bulk endpoint, and a package needs the ids of
   * the lines written before it. A failure stops the run where it is. */

  /**
   * Re-point, then delete — never the other way round, or a programme is left
   * holding a line whose service no longer exists. Stops on the first failure
   * and says where it stopped, so a half-done tidy can be finished by pressing
   * again (both halves are idempotent: a re-point that already landed is a
   * no-op, and a delete of a row that is gone is reported and skipped).
   */
  const runTidy = async () => {
    if (busy || !hasWork(tidy)) return;
    setBusy(true);
    try {
      for (const p of tidy.repoint) {
        setTidying(`Moving ${p.name}…`);
        await projectsAdmin.updatePackage(p.id, {
          lines: p.lines,
          expected_version: p.version,
        } as PackageTemplatePatch);
      }
      for (const r of tidy.remove) {
        setTidying(`Deleting “${r.name}”…`);
        await projectsAdmin.deleteService(r.id);
      }
      setGen((g) => g + 1); // re-read, so the card shows what is now true
    } catch (err) {
      setTpl((cur) => ({
        ...cur,
        error:
          (err instanceof Error ? err.message : 'The tidy did not finish.') +
          ' Nothing after that point was changed — press again to carry on.',
      }));
    } finally {
      setTidying('');
      setBusy(false);
    }
  };

  const run = async () => {
    if (busy || !ready) return;
    setBusy(true);
    setReport(null);
    const added: SeedCounts = { services: 0, packages: 0, checklists: 0 };
    const skipped: SeedCounts = {
      services: tick.services ? plans.services.skip.length : 0,
      packages: tick.packages ? plans.packages.skip.length : 0,
      checklists: tick.checklists ? plans.checklists.skip.length : 0,
    };
    const short: ShortPackage[] = [];
    let failure: string | null = null;
    try {
      if (tick.services) {
        const rows = plans.services.create;
        let n = 0;
        for (const s of rows) {
          n += 1;
          setStep({ label: 'Adding service lines', done: n, total: rows.length });
          await projectsAdmin.createService(serviceInput(s, seedCurrency));
          added.services += 1;
        }
      }
      if (tick.packages && plans.packages.create.length) {
        setStep({ label: 'Re-reading the service catalogue', done: 0, total: 0 });
        // the WHOLE catalogue: a template's named line resolves against the
        // rows just created AND the ones that were already here
        const idByName = serviceIdIndex(await walkServices(projectsAdmin));
        const rows = plans.packages.create;
        let n = 0;
        for (const p of rows) {
          n += 1;
          setStep({ label: 'Adding package templates', done: n, total: rows.length });
          const missing = missingServices(p, idByName);
          if (missing.length) {
            short.push({ name: p.name, missing });
            continue;
          }
          await projectsAdmin.createPackage(packageInput(p, idByName));
          added.packages += 1;
        }
      }
      if (tick.checklists) {
        const rows = plans.checklists.create;
        let n = 0;
        for (const c of rows) {
          n += 1;
          setStep({ label: 'Adding checklist templates', done: n, total: rows.length });
          await projectsAdmin.createChecklist(checklistInput(c));
          added.checklists += 1;
        }
      }
    } catch (err: unknown) {
      failure = err instanceof Error ? err.message : 'That did not go through.';
    }
    setStep(null);
    setBusy(false);
    setReport({ added, skipped, short, error: failure });
    setGen((g) => g + 1); // the preview re-reads what is there now
    if (added.services || added.packages || added.checklists) onDone();
  };

  return (
    <div className="dzp-svcgrp">
      <div className="gh">Service catalogue · Standard set</div>
      <p className="dzp-mut">
        These are Darz’s own services — the exhibition services the gallery portal already
        offers, with their real prices, and the Exhibition Coverage programmes, which Darz
        quotes per show — plus the checklist templates. Anything already here by name is
        skipped, so it is safe to run twice.
      </p>
      {tpl.error && <DeskBanner>{tpl.error}</DeskBanner>}
      {SEED_KINDS.map((k) => (
        <label className="dzp-chk" key={k}>
          <input
            type="checkbox"
            checked={tick[k]}
            disabled={busy}
            onChange={(e) => toggle(k, e.target.checked)}
          />
          {SEED_TICKS[k]}
        </label>
      ))}
      {/* the currency is the owner’s decision — Iranian galleries are priced in
          Toman — so the card names it before the run rather than leaving the
          figures unlabelled. The fallback itself is unchanged: the served list
          decides, and this only says which way it went */}
      {seedCurrency === STANDARD_CURRENCY ? (
        <p className="dzp-mut" role="note">
          The lines are added in {currencyName(STANDARD_CURRENCY)} — Darz’s own prices, in the
          currency Iranian galleries are quoted in. International galleries come later, in USD
          or EUR chosen at the time; nothing here decides that.
        </p>
      ) : (
        <p className="dzp-mut" role="note">
          These are Toman prices and this workspace does not offer {STANDARD_CURRENCY} — the
          lines are added in {currencyName(seedCurrency)} at the same numbers, so a Toman
          figure reads as {seedCurrency} until you reprice it. Add {STANDARD_CURRENCY} to the
          currency options first if that is not what you want.
        </p>
      )}
      {/* the numbers, stated before the run rather than discovered after it */}
      {STANDARD_SET_COUNTS.unpriced > 0 && (
        <p className="dzp-mut" role="note">
          {STANDARD_SET_COUNTS.unpriced} of the {STANDARD_SET_COUNTS.services} service lines
          arrive unpriced — the coverage work Darz quotes per show, and Darz Listing, which is
          on request. The catalogue has no “on request”, so they are written as 0: not priced
          yet, never free, and the calculator quotes them at 0 until you price them. The other{' '}
          {priced} carry the real exhibition-service prices the gallery portal already quotes.
        </p>
      )}
      {/* no internal cost exists for these, and the calculator prices from this
          catalogue (D21) — so it reads cost as nil until the owner enters one */}
      <p className="dzp-mut" role="note">
        No internal cost comes with them: Darz has none recorded for these services, so every
        line is written at 0 and the calculator’s margin reads against a nil cost until you
        enter one.
      </p>
      {/* G-PROJ-8 — the description now has a column; the rest still does not */}
      <p className="dzp-mut" role="note">
        The names and descriptions carry over. How each service runs, its timing and what Darz
        needs from the gallery stay in the source menus — a service line here has no field for
        them.
      </p>
      {/* Four pairs named one service twice. The owner ruled on 2026-09-19
          that each pair IS one service, so each is a single line here — said
          out loud because the coverage menu still lists the other name, and a
          reader comparing the two would otherwise think a service went
          missing. The overlap is on the row’s own title. */}
      {MERGED_SERVICES.length > 0 && (
        <>
          <p className="dzp-mut" role="note">
            {mergedLead(MERGED_SERVICES.length)} — one line each, keeping the priced name the
            gallery already sees in its portal:
          </p>
          {MERGED_SERVICES.map((m) => (
            <div className="dzp-mut" key={m.folded} title={m.why}>
              “{m.folded}” is part of “{m.kept}”
            </div>
          ))}
        </>
      )}
      {/* A workspace seeded before that ruling still holds the folded rows as
          their own lines: the seed only ever adds. Name them; deleting one is
          the owner's click on its own row, never this card's. */}
      {/* A workspace seeded before the ruling holds the folded rows, and its
          programmes still point at them. Tidying is one action rather than an
          instruction, because the ORDER matters: re-point, then delete
          (`tidyUp.ts`). */}
      {stale.length > 0 && (
        <>
          <p className="dzp-mut" role="note">
            This workspace still has {stale.length === 1 ? 'a line' : `${stale.length} lines`}{' '}
            from before that ruling — {joinWords(stale.map((r) => `“${r.name}”`))}.{' '}
            {describeTidy(tidy)}
          </p>
          <div className="dzp-acts" style={{ marginTop: 6 }}>
            <button
              type="button"
              className="dzp-btn"
              disabled={busy || !hasWork(tidy)}
              onClick={() => void runTidy()}
            >
              {busy && tidying ? tidying : 'Tidy them up'}
            </button>
          </div>
        </>
      )}
      {!ready && !tpl.error && <p className="dz-state">Loading…</p>}
      {ready && (
        <div style={{ marginTop: 4 }}>
          {SEED_KINDS.filter((k) => tick[k]).map((k) => (
            <div className="dzp-mut" key={k}>
              {SEED_TITLES[k]} · {creatable[k]} to add · {plans[k].skip.length} already there
              {k === 'packages' && shortPackages.length > 0
                ? ` · ${shortPackages.length} waiting on service lines this run will not add`
                : ''}
            </div>
          ))}
        </div>
      )}
      {step && (
        <p className="dzp-mut" role="status">
          {step.total > 0 ? `${step.label}… ${step.done} of ${step.total}` : `${step.label}…`}
        </p>
      )}
      {report?.error && (
        <DeskBanner>
          {report.error} {failureText(report)} Press “Add to this workspace” again to carry on
          where it stopped — anything already there is skipped.
        </DeskBanner>
      )}
      {report && !report.error && (
        <p className="dzp-mut" role="status">
          {resultText(report)}
        </p>
      )}
      {report?.short.map((s) => (
        <p className="dzp-mut" role="status" key={s.name}>
          “{s.name}” was not added: the catalogue has no{' '}
          {joinWords(s.missing.map((m) => `“${m}”`))}.
        </p>
      ))}
      <div className="dzp-acts">
        <button type="button" className="dzp-btn gho" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="dzp-btn pri"
          disabled={busy || !ready || toAdd === 0}
          onClick={() => void run()}
        >
          Add to this workspace
        </button>
      </div>
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
    walkProjects(projectsAdmin).then(
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
        <ConflictBanner
          noun="project"
          reloadClassName="dzp-btn sm"
          onReload={() => {
            setConflict(false);
            setGen((g) => g + 1);
          }}
        />
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
