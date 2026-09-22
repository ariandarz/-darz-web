/**
 * ProjectsListPage — `/admin/projects/list`, the Projects list
 * (`DZProjects.list` / `_row` / `search` / `setFilt` / `toggleArch` /
 * `clearQuick`, `darz-studio.html:13626-13678`) over
 * `GET /projects/admin/projects/`.
 *
 * Ported content:
 *  - the heading, the counted sub (:13653) and "＋ New project" (:13654 —
 *    the `/admin/projects/new` route instead of the modal);
 *  - the toolbar (:13655-13660): search, Category, Status, the Archived
 *    toggle — as the desk kit's filters, with the old placeholder and
 *    "All …" wordings;
 *  - the quick-filter chip with its `clear` link (:13646-13647, :13661);
 *  - the row anatomy (:13666-13673): name · client · city · number, the
 *    category chip and the status pill, "Stage:" / "Next:" and, for the
 *    owner, the per-currency money line (`projCanMoney()`, :13667);
 *  - the empty sentence (:13650);
 *  - the one `Lib.toast` line that lands here, "Project deleted" (:13895) —
 *    the record hands it over as `location.state.note` and it shows as the
 *    inline status line the contract prescribes.
 *
 * Mechanics that changed:
 *  - the old `PROJV` in-memory view state lives in the URL (`?search=
 *    &category=&status=&archived=&quick=&page=`), so the dashboard cards
 *    deep-link here and back/forward keeps the filters. The `ListController`
 *    follows the URL (`follow()`), never the other way round.
 *  - the normal list is server-paginated and server-filtered
 *    (`ProjectFilterSet`: search on name/no/client_name/venue; exact
 *    category/status/archived). The old sort by last-updated (:13641) has
 *    no ordering key on the API (`created|name` only), so the server's
 *    default order stands there.
 *  - two stated absences under the toolbar (never a silent drop): the
 *    server search (`filters.py:6`) reads name / no / client_name / venue,
 *    not the city, contact or category the old haystack (:13638) also
 *    matched — the old placeholder (:13656) is kept verbatim and the note
 *    says what it does not cover (G-PROJ-1); and `status` follows the stage
 *    (`STAGE_STATUS_MAP`, `models.py:221-237`, G-PROJ-2), so four of the
 *    `projects.status` choices the old select could set by hand (:13645,
 *    :13781) — Negotiation, Scheduled, Completed, Cancelled — never match.
 *    The choices themselves stay server-fed (no hardcoded label list).
 *  - QUICK MODE (`?quick=active|delayed|approval|deliverables|unpaid`): the
 *    API has no quick filter (G-PROJ-1), so the page walks every
 *    non-archived project once (`archived: false, per_page: 100`,
 *    `has_next` followed) and filters client-side — `matchesQuick` plus the
 *    old category / status / search rules (:13636-13638), sorted by
 *    `updated_at` like :13641. The pager is hidden there; the whole match
 *    set is shown. A quick filter only ever selects ACTIVE projects
 *    (:13631-13635), so switching Archived on drops it (the old list kept
 *    the chip and showed an empty list — a dead end, not ported).
 *  - the old 170 ms search debounce (:13675) is not ported: the kit's
 *    SearchFilter applies per keystroke and the controller's token guard
 *    drops stale responses, like every other desk.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useApi, useOptions, useSession } from '../../../api/hooks';
import type { ProjectsAdminService } from '../../../api/services';
import type { Choice, Paginated, ProjectAdmin, ProjectQuery } from '../../../api/types';
import { ListController } from '../../shared/ListController';
import { useListController } from '../../shared/useListController';
import { asAdminRole } from '../adminNav';
import {
  DeskAction,
  DeskBanner,
  DeskPage,
  Pager,
  SearchFilter,
  SelectFilter,
  ToggleFilter,
  deskBanner,
  resolveDeskView,
} from '../kit';
import {
  QUICK_LABELS,
  choiceLabel,
  choices,
  clientName,
  defaultCurrency,
  isQuick,
  matchesQuick,
  moneyCalc,
  nextDelText,
  projFlag,
  projMoney,
  stageLabel,
  todayIso,
  walkProjects,
  type Quick,
} from './projectForm';
import '../admin.css';

class ProjectsController extends ListController<ProjectAdmin, ProjectQuery> {
  private readonly projects: ProjectsAdminService;
  constructor(projects: ProjectsAdminService, initial: ProjectQuery = {}) {
    super(initial);
    this.projects = projects;
  }
  protected fetchPage(query: ProjectQuery): Promise<Paginated<ProjectAdmin>> {
    return this.projects.projects(query);
  }
  /** Follow the URL: replace the whole query, page included, without the
   * base class's page-1 reset — the URL already says which page it is on. */
  follow(next: ProjectQuery): void {
    this.patch({ query: { ...next, page: next.page ?? 1 } });
    void this.reload();
  }
}

/** The old `PROJV` (q / cat / fStatus / arch / quick), read off the URL. */
interface ListView {
  search?: string;
  category?: string;
  status?: string;
  archived: boolean;
  quick: Quick | null;
  page: number;
}

function readView(params: URLSearchParams): ListView {
  const archived = params.get('archived') === 'true';
  const quick = params.get('quick');
  return {
    search: params.get('search') || undefined,
    category: params.get('category') || undefined,
    status: params.get('status') || undefined,
    archived,
    // every quick filter requires an active project (:13631-13635), so an
    // archived view has no quick filter to apply
    quick: !archived && isQuick(quick) ? quick : null,
    page: Math.max(1, Number(params.get('page')) || 1),
  };
}

function toQuery(v: ListView): ProjectQuery {
  return {
    search: v.search,
    category: v.category,
    status: v.status,
    archived: v.archived,
    page: v.page,
  };
}

function sameQuery(a: ProjectQuery, b: ProjectQuery): boolean {
  return (
    (a.search ?? '') === (b.search ?? '') &&
    (a.category ?? '') === (b.category ?? '') &&
    (a.status ?? '') === (b.status ?? '') &&
    !!a.archived === !!b.archived &&
    (a.page ?? 1) === (b.page ?? 1)
  );
}

/** The old search haystack (:13638). */
function hay(p: ProjectAdmin): string {
  return [p.no, p.name, clientName(p), p.contact, p.venue, p.city, p.category]
    .join(' ')
    .toLowerCase();
}

export function ProjectsListPage() {
  const { projectsAdmin } = useApi();
  const options = useOptions();
  const { me } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const canMoney = asAdminRole(me?.role) === 'owner'; // projCanMoney(), :13282

  // the record's `Lib.toast('Project deleted')` (:13895) as a status line —
  // ProjectPage hands it over in `location.state.note` after the delete
  const [note] = useState<string | null>(
    () => (location.state as { note?: string } | null)?.note ?? null,
  );

  const stages = choices(options, 'projects.stage');
  const categories = choices(options, 'projects.category');
  const statuses = choices(options, 'projects.status');
  const currency = defaultCurrency(options);
  const today = todayIso();

  const view = useMemo(() => readView(params), [params]);
  const quick = view.quick;

  // the normal (server-paginated) list — its query follows the URL
  const [controller] = useState(
    () => new ProjectsController(projectsAdmin, toQuery(readView(params))),
  );
  const { state } = useListController<ProjectAdmin, ProjectQuery>(() => controller);
  const urlQuery = useMemo(() => toQuery(view), [view]);
  useEffect(() => {
    if (!sameQuery(state.query, urlQuery)) controller.follow(urlQuery);
  }, [controller, state.query, urlQuery]);

  // quick mode — one walk of the active set per visit, filtered client-side
  const [walk, setWalk] = useState<{ rows: ProjectAdmin[] | null; error: string | null }>({
    rows: null,
    error: null,
  });
  const needWalk = quick !== null && walk.rows === null && walk.error === null;
  useEffect(() => {
    if (!needWalk) return;
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
  }, [needWalk, projectsAdmin]);

  const quickRows = useMemo(() => {
    if (!quick || !walk.rows) return null;
    const q = (view.search ?? '').toLowerCase();
    return walk.rows
      .filter((p) => matchesQuick(p, quick, today))
      .filter((p) => !view.category || p.category === view.category) // :13636
      .filter((p) => !view.status || (p.status ?? '') === view.status) // :13637
      .filter((p) => !q || hay(p).includes(q)) // :13638
      .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)); // :13641
  }, [quick, walk.rows, view.search, view.category, view.status, today]);

  // the sub's "{active} active · {total} total" (:13653) — two counts
  const [counts, setCounts] = useState<{ active: number; total: number } | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([
      projectsAdmin.projects({ per_page: 1, archived: false }),
      projectsAdmin.projects({ per_page: 1 }),
    ]).then(
      ([active, total]) =>
        alive &&
        setCounts({
          active: active.pagination.total_count,
          total: total.pagination.total_count,
        }),
      () => undefined, // the sub simply keeps its second sentence
    );
    return () => {
      alive = false;
    };
  }, [projectsAdmin]);

  /** Write a filter change to the URL. Anything but a page change starts
   * again at page 1 (the same rule `ListController.setQuery` applies). */
  const update = (patch: Record<string, string | undefined>, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace });
  };
  const clearQuick = new URLSearchParams(params);
  clearQuick.delete('quick');
  clearQuick.delete('page');
  const clearQuickSearch = clearQuick.toString();

  const rows = quick ? (quickRows ?? []) : state.results;
  const status = quick
    ? walk.error
      ? 'error'
      : quickRows
        ? 'idle'
        : 'loading'
    : state.status;
  const body = resolveDeskView(status, rows.length);
  const banner = deskBanner(status, quick ? walk.error : state.error);

  return (
    <DeskPage
      title="Projects"
      action={
        <DeskAction onClick={() => navigate('/admin/projects/new')}>＋ New project</DeskAction>
      }
      toolbar={
        <>
          {/* :13656 — typed per keystroke; `replace` keeps Back one step, not one letter */}
          <SearchFilter
            label="Search"
            value={view.search}
            onChange={(search) => update({ search }, true)}
            placeholder="Search project, client, venue, city…"
          />
          {/* :13644, :13657 */}
          <SelectFilter
            label="Category"
            anyLabel="All categories"
            value={view.category}
            onChange={(category) => update({ category })}
            choices={categories}
          />
          {/* :13645, :13658 */}
          <SelectFilter
            label="Status"
            anyLabel="All statuses"
            value={view.status}
            onChange={(status) => update({ status })}
            choices={statuses}
          />
          {/* :13659 — on: also drops the quick filter, which only selects active projects */}
          <ToggleFilter
            label="Archived"
            checked={view.archived}
            onChange={(on) =>
              update(on ? { archived: 'true', quick: undefined } : { archived: undefined })
            }
          />
        </>
      }
      subtitle={
        /* :13653 */
        <>
          {counts ? `${counts.active} active · ${counts.total} total. ` : ''}
          One record per project — client and partners are linked, never re-typed.
        </>
      }
    >
      <div className="dzp">
        {quick && (
          // :13647 / :13661 — the chip and its wrapper carried these two inline styles
          <div style={{ margin: '-4px 0 10px' }}>
            <span className="dzp-chip">
              {QUICK_LABELS[quick]} ·{' '}
              <Link
                to={{ search: clearQuickSearch ? `?${clearQuickSearch}` : '' }}
                style={{ color: 'var(--magenta)' }}
              >
                clear
              </Link>
            </span>
          </div>
        )}

        {note && (
          <p className="dzp-mut" role="status">
            {note}
          </p>
        )}

        {/* stated absences — the server search (`ProjectFilterSet`, filters.py:6)
            covers name/no/client_name/venue, while the old haystack (:13638) also
            read city, contact and category (quick mode still applies the old
            haystack client-side, so that sentence goes only with the server
            list); `status` follows the stage (`STAGE_STATUS_MAP`, models.py:221-
            237), so four choices the old select could set by hand (:13645) never
            match a project here */}
        <p className="dzp-mut" role="note">
          {!quick &&
            'Search matches the name, number, client name and venue on this API — not the city or contact yet (G-PROJ-1). '}
          Status follows the stage (G-PROJ-2): Negotiation, Scheduled, Completed and Cancelled
          are never set, so those filters match nothing.
        </p>

        {banner && <DeskBanner>{banner}</DeskBanner>}
        {body === 'loading' && <p className="dz-state">Loading…</p>}
        {/* :13650 */}
        {body === 'empty' && <div className="dzp-empty">No projects match these filters.</div>}
        {body === 'rows' && (
          <div className="dzp-list">
            {rows.map((p) => (
              <ProjectRow
                key={p.id}
                p={p}
                stages={stages}
                categories={categories}
                canMoney={canMoney}
                currency={currency}
                today={today}
              />
            ))}
          </div>
        )}

        {!quick && state.pagination && (
          <Pager
            pagination={state.pagination}
            onPage={(page) => update({ page: String(page) })}
          />
        )}
      </div>
    </DeskPage>
  );
}

/** `DZProjects._row` (:13666-13673) — the row is a link into the record. */
function ProjectRow({
  p,
  stages,
  categories,
  canMoney,
  currency,
  today,
}: {
  p: ProjectAdmin;
  stages: Choice[];
  categories: Choice[];
  canMoney: boolean;
  currency: string;
  today: string;
}) {
  const flag = projFlag(p, stages, today);
  const mc = moneyCalc(p, currency);
  const client = clientName(p);
  return (
    <Link className="dzp-row" to={`/admin/projects/${p.id}`}>
      <div className="dzp-who">
        <div className="t">{p.name || 'Untitled project'}</div>
        <div className="a">
          {client || 'No client'}
          {p.city ? ` · ${p.city}` : ''}
        </div>
        <div className="no">{p.no || ''}</div>
      </div>
      <div className="dzp-mid">
        {/* projCatLabel (:13292) fell back to a dash */}
        <span className="dzp-chip">{choiceLabel(categories, p.category) || '—'}</span>
        <span className={`dzp-pill ${flag.c}`}>{flag.t}</span>
      </div>
      <div className="dzp-end">
        <div className="dzp-nx">
          Stage: <b>{stageLabel(stages, p.stage)}</b>
        </div>
        <div className="dzp-nx">
          Next: <b>{nextDelText(p)}</b>
        </div>
        {/* :13668 — owner only, one figure per currency, never converted */}
        {canMoney && mc.currencies.length > 0 && (
          <div className="dzp-nx">
            {mc.currencies
              .map((c) => projMoney(mc.byCur[c].client || mc.byCur[c].fee, c))
              .join(' · ')}
          </div>
        )}
      </div>
    </Link>
  );
}
