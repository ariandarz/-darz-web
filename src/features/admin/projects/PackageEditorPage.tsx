/**
 * PackageEditorPage — `/admin/projects/packages/new` (`?custom=1` for the
 * custom proposal) and `/admin/projects/packages/:id`, the old package modal
 * (`DZProjects.newPackage` / `editPackage` / `customProposal` / `_blankPkg`
 * / `_pkgModal` / `_pkgForm`, the `pkg*` setters and `savePackage`,
 * `darz-studio.html:13951-13996`; `applyPackageDraft` :14001) as a route
 * over `GET|POST|PATCH /projects/admin/packages/{id}/`.
 *
 * Ported content:
 *  - the three titles (:13951-13953): New package / Edit package / Custom
 *    proposal — the custom one seeded with the name and purpose of :13953
 *    and saving as "Save as template" (:13981);
 *  - the form (:13972-13979): Package name, Purpose; the Service lines
 *    (name, a count, ✕, "No service lines yet.", the "＋ Add a service
 *    line…" menu grouped per category); the Counts (Posts … Video min, the
 *    On-site production tick); the ten text fields (:13976) in the old
 *    order and widths; Optional add-ons (name, price, currency, ✕, "No
 *    add-ons.", "＋ Add-on"); Payment stages (Stage, %, ✕, "No stages.",
 *    "＋ Stage"); for the owner the "Internal — owner / finance only"
 *    block (:13966);
 *  - the footer (:13981): Cancel, Preview proposal, Apply to project, Save
 *    package / Save as template; "Name the package" (:13996), "Add at least
 *    one service line" (:14001), "Package saved" (:13996);
 *  - the defaults of `_blankPkg` (:13954) via `blankPackage()`.
 *
 * Mechanics that changed:
 *  - a route instead of `_modal`; the working copy `_pkgDraft` is React
 *    state with every number kept as typed until save (the old setters
 *    ran `projN` on each keystroke and a re-render snapped the field);
 *  - a create navigates to the new id's editor (the old re-listed); an
 *    update carries `expected_version` — a 409 is the conflict banner with
 *    Reload;
 *  - "Apply to project" applied the unsaved draft as a snapshot (:14001)
 *    and a custom proposal only became a template through "Save as
 *    template" (:13981); the API's apply is a FK to a saved template, so
 *    the page saves first (a custom proposal as a template), then runs the
 *    same inline pick the cards use (`ProjectPick`) — a note under the
 *    footer says so, since nothing else on screen would;
 *  - "Preview proposal" (:13981 `proposalFromEditor`, the preview of an
 *    unsaved draft) has no desk here: the proposal is a section of the
 *    project record, so the button takes the Apply path (save, pick, the
 *    record link) and the same note says why — a stated redirect, not a
 *    dead button;
 *  - the create's hand-off (`location.state` — the "Package saved" line and
 *    whether to open the pick) is read once and cleared, so a refresh does
 *    not replay it;
 *  - `internal` is the owner's block (:13964): a standard admin's PATCH
 *    never carries it, so the stored pricing survives their edit; their
 *    create sends the blank defaults (:13954);
 *  - the old `team` / `suppliers` had no inputs in this form (:13954 blank
 *    lists) — carried through untouched, same as before;
 *  - the add-on / stage rows' inputs were bare `<input>`s in the old
 *    modal (`.dzp-line input` sizes them, nothing styles them, :13541) —
 *    kept as they were.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ConflictError } from '../../../api/errors';
import { useApi, useOptions, useSession } from '../../../api/hooks';
import type {
  Choice,
  PackageTemplateAdmin,
  PackageTemplateInput,
  ProjectAdmin,
  ServiceCatalogItemAdmin,
} from '../../../api/types';
import { asAdminRole } from '../adminNav';
import { DeskBanner, DeskPage } from '../kit';
import { ProjectPick } from './PackagesPage';
import {
  applyPackage,
  asAddons,
  asCounts,
  asInternal,
  asPackageLines,
  asPackagePaymentStages,
  asStringList,
  blankPackage,
  choices,
  defaultCurrency,
  projN,
  svcName,
  walkServices,
  type PackageAddon,
  type PackageCounts,
  type PackageInternal,
  type PackageLine,
  type PackagePaymentStage,
} from './projectForm';
import '../admin.css';

const CONFLICT = 'Someone else saved this package in the meantime — reload to continue.';

/* :13975 — the count fields, in order */
const COUNT_KEYS = [
  'posts',
  'stories',
  'articles',
  'interviews',
  'photos',
  'videos',
  'videoMin',
] as const;
type CountKey = (typeof COUNT_KEYS)[number];
const COUNT_LABELS: Record<CountKey, string> = {
  posts: 'Posts',
  stories: 'Stories',
  articles: 'Articles',
  interviews: 'Interviews',
  photos: 'Photos',
  videos: 'Videos',
  videoMin: 'Video min',
};

/* :13966 — the owner's internal block, in order */
const INTERNAL_KEYS = [
  'internalCost',
  'externalCost',
  'minFee',
  'recFee',
  'targetMargin',
] as const;
type InternalKey = (typeof INTERNAL_KEYS)[number];
const INTERNAL_LABELS: Record<InternalKey, string> = {
  internalCost: 'Internal cost',
  externalCost: 'External cost',
  minFee: 'Minimum fee',
  recFee: 'Recommended fee',
  targetMargin: 'Target margin %',
};

type TextKey =
  | 'client_resp'
  | 'materials'
  | 'prod_timeline'
  | 'pub_timeline'
  | 'revisions'
  | 'approval'
  | 'usage_rights'
  | 'archive_duration'
  | 'cancellation'
  | 'deposit_pct';

/* :13976 — the ten text fields, in order, `full` where the old said so */
const TEXT_FIELDS: Array<{ key: TextKey; label: string; full?: boolean }> = [
  { key: 'client_resp', label: 'Client responsibilities', full: true },
  { key: 'materials', label: 'Required materials', full: true },
  { key: 'prod_timeline', label: 'Production timeline' },
  { key: 'pub_timeline', label: 'Publication timeline' },
  { key: 'revisions', label: 'Revision rounds' },
  { key: 'approval', label: 'Approval process' },
  { key: 'usage_rights', label: 'Usage rights', full: true },
  { key: 'archive_duration', label: 'Archive duration' },
  { key: 'cancellation', label: 'Cancellation terms', full: true },
  { key: 'deposit_pct', label: 'Deposit %' },
];

/** `_pkgDraft` (:13951-13953) — the working copy, numbers as typed. */
interface Draft {
  name: string;
  purpose: string;
  lines: Array<{ svcId: string; count: string }>;
  counts: Record<CountKey, string>;
  onsite: boolean;
  team: string[];
  suppliers: string[];
  client_resp: string;
  materials: string;
  prod_timeline: string;
  pub_timeline: string;
  revisions: string;
  approval: string;
  usage_rights: string;
  archive_duration: string;
  cancellation: string;
  deposit_pct: string;
  addons: Array<{ name: string; price: string; currency: string }>;
  internal: Record<InternalKey, string>;
  payment_stages: Array<{ label: string; pct: string }>;
}

const str = (v: unknown): string => (v == null ? '' : String(v));

/** The draft of a saved template or of `blankPackage()` — the JSON fields
 * through their guards, so an odd blob still opens. */
function fromPackage(src: PackageTemplateInput): Draft {
  const c = asCounts(src.counts);
  const it = asInternal(src.internal);
  return {
    name: str(src.name),
    purpose: str(src.purpose),
    lines: asPackageLines(src.lines).map((l) => ({ svcId: l.svcId, count: String(l.count) })),
    counts: {
      posts: String(c.posts),
      stories: String(c.stories),
      articles: String(c.articles),
      interviews: String(c.interviews),
      photos: String(c.photos),
      videos: String(c.videos),
      videoMin: String(c.videoMin),
    },
    onsite: src.onsite === true,
    team: asStringList(src.team),
    suppliers: asStringList(src.suppliers),
    client_resp: str(src.client_resp),
    materials: str(src.materials),
    prod_timeline: str(src.prod_timeline),
    pub_timeline: str(src.pub_timeline),
    revisions: str(src.revisions),
    approval: str(src.approval),
    usage_rights: str(src.usage_rights),
    archive_duration: str(src.archive_duration),
    cancellation: str(src.cancellation),
    deposit_pct: str(src.deposit_pct),
    addons: asAddons(src.addons).map((a) => ({
      name: a.name,
      price: a.price ? String(a.price) : '',
      currency: a.currency,
    })),
    internal: {
      internalCost: String(it.internalCost),
      externalCost: String(it.externalCost),
      minFee: String(it.minFee),
      recFee: String(it.recFee),
      targetMargin: String(it.targetMargin),
    },
    payment_stages: asPackagePaymentStages(src.payment_stages).map((s) => ({
      label: s.label,
      pct: s.pct ? String(s.pct) : '',
    })),
  };
}

/** The body a save sends — the contract's JSON shapes, numbers via `projN`
 * (the old setters, :13985-13995; a line count never below 1, :13988). */
function toInput(d: Draft): PackageTemplateInput {
  const lines: PackageLine[] = d.lines.map((l) => ({
    svcId: l.svcId,
    count: projN(l.count) || 1,
  }));
  const counts: PackageCounts = {
    posts: projN(d.counts.posts),
    stories: projN(d.counts.stories),
    articles: projN(d.counts.articles),
    interviews: projN(d.counts.interviews),
    photos: projN(d.counts.photos),
    videos: projN(d.counts.videos),
    videoMin: projN(d.counts.videoMin),
  };
  const addons: PackageAddon[] = d.addons.map((a) => ({
    name: a.name,
    price: projN(a.price),
    currency: a.currency,
  }));
  const internal: PackageInternal = {
    internalCost: projN(d.internal.internalCost),
    externalCost: projN(d.internal.externalCost),
    minFee: projN(d.internal.minFee),
    recFee: projN(d.internal.recFee),
    targetMargin: projN(d.internal.targetMargin),
  };
  const payment_stages: PackagePaymentStage[] = d.payment_stages.map((s) => ({
    label: s.label,
    pct: projN(s.pct),
  }));
  return {
    name: d.name.trim(),
    purpose: d.purpose,
    lines,
    counts,
    onsite: d.onsite,
    team: d.team,
    suppliers: d.suppliers,
    client_resp: d.client_resp,
    materials: d.materials,
    prod_timeline: d.prod_timeline,
    pub_timeline: d.pub_timeline,
    revisions: projN(d.revisions),
    approval: d.approval,
    usage_rights: d.usage_rights,
    archive_duration: d.archive_duration,
    addons,
    internal,
    deposit_pct: projN(d.deposit_pct),
    payment_stages,
    cancellation: d.cancellation,
  };
}

/** `_blankPkg` (:13954) — seeded for the custom proposal (:13953). */
function seed(custom: boolean): PackageTemplateInput {
  const b = blankPackage();
  if (custom) {
    b.name = 'Custom proposal';
    b.purpose = 'A one-off proposal assembled from individual service lines.';
  }
  return b;
}

/** :13960 — the "＋ Add a service line…" menu's optgroups, one per
 * category in option order; a category the options do not list still
 * shows under its raw key. */
function groupByCategory(
  rows: ServiceCatalogItemAdmin[],
  categories: Choice[],
): Array<{ cat: string; label: string; rows: ServiceCatalogItemAdmin[] }> {
  const out: Array<{ cat: string; label: string; rows: ServiceCatalogItemAdmin[] }> = [];
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

interface RouteState {
  note?: string;
  apply?: boolean;
}

export function PackageEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const custom = !id && params.get('custom') === '1';
  // keyed so `/new` → `/:id` after a create, or one id → another, starts a
  // fresh editor instead of re-seeding the one on screen
  return (
    <PackageEditor key={id ?? (custom ? 'custom' : 'new')} id={id ?? ''} custom={custom} />
  );
}

function PackageEditor({ id, custom }: { id: string; custom: boolean }) {
  const { projectsAdmin } = useApi();
  const options = useOptions();
  const { me } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const canMoney = asAdminRole(me?.role) === 'owner'; // projCanMoney(), :13282
  const categories = choices(options, 'projects.service_category');
  const currencies = choices(options, 'currency');
  const cur = defaultCurrency(options); // projDefCur(), :13990

  const [pkg, setPkg] = useState<PackageTemplateAdmin | null>(null);
  const [draft, setDraft] = useState<Draft | null>(() =>
    id ? null : fromPackage(seed(custom)),
  );
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  // the old `Lib.toast` lines as a status line; a create hands its own in
  const [note, setNote] = useState<string | null>(
    () => (location.state as RouteState | null)?.note ?? null,
  );
  // "Apply to project" on an unsaved draft saves first, then continues here
  const [applyOpen, setApplyOpen] = useState<boolean>(
    () => (location.state as RouteState | null)?.apply === true,
  );
  // the hand-off is read once: React Router keeps `state` in history, so a
  // refresh would show "Package saved" again and re-open the pick (and its
  // whole active-project walk) on every reload of this URL
  useEffect(() => {
    if (location.state)
      navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, navigate]);

  // promise chains, not async/await: state is set in the settle callbacks
  const load = useCallback(() => {
    if (!id) return Promise.resolve();
    return projectsAdmin.packageTemplate(id).then(
      (p) => {
        setPkg(p);
        setDraft(fromPackage(p));
        setError(null);
      },
      (err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load the package.'),
    );
  }, [projectsAdmin, id]);
  useEffect(() => {
    void load();
  }, [load]);

  // the catalogue — names the lines and fills the add menu (:13959-13961)
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
  }, [projectsAdmin]);
  const catalogue = svcWalk.rows;
  const groups = groupByCategory(catalogue ?? [], categories);

  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  /** `savePackage` (:13996). A create moves to the new id's editor. */
  const save = async (thenApply: boolean): Promise<PackageTemplateAdmin | null> => {
    if (!draft || busy) return null;
    if (!draft.name.trim()) {
      setError('Name the package'); // :13996
      return null;
    }
    setBusy(true);
    setError(null);
    setConflict(false);
    setNote(null);
    const body = toInput(draft);
    // the internal block is the owner's (:13964) — a standard admin's
    // update never carries it, so the stored pricing survives their edit
    if (!canMoney && pkg) delete body.internal;
    try {
      if (pkg) {
        const saved = await projectsAdmin.updatePackage(pkg.id, {
          ...body,
          expected_version: pkg.version,
        });
        setPkg(saved);
        setDraft(fromPackage(saved));
        setNote('Package saved'); // :13996
        return saved;
      }
      const created = await projectsAdmin.createPackage(body);
      navigate(`/admin/projects/packages/${created.id}`, {
        replace: true,
        state: { note: 'Package saved', apply: thenApply } satisfies RouteState,
      });
      return created;
    } catch (err: unknown) {
      if (err instanceof ConflictError) setConflict(true);
      else setError(err instanceof Error ? err.message : 'Could not save the package.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  /** `applyPackageDraft` (:14001): the line check, then save, then pick. */
  const applyToProject = async () => {
    if (!draft) return;
    if (!draft.lines.length) {
      setError('Add at least one service line'); // :14001
      return;
    }
    if (pkg) {
      const saved = await save(false);
      if (saved) setApplyOpen(true);
    } else await save(true); // continues in the new id's editor
  };

  /** `_doApplyPackage` (:14002-14014) for the saved template; `now` is the
   * pick's click moment, stamping the new deliverable / payment ids. */
  const applyTo = async (project: ProjectAdmin, now: number) => {
    if (!pkg) return null;
    // the deliverable texts are the services' names (:14006) — never apply
    // over a catalogue that has not arrived, or every line reads "(removed service)"
    if (!catalogue)
      throw new Error('The service catalogue has not loaded yet — try again in a moment.');
    const p = applyPackage(project, pkg, catalogue, cur, now);
    const saved = await projectsAdmin.updateProject(project.id, {
      ...p,
      expected_version: project.version,
    });
    return (
      // :14014
      <>
        Applied “{pkg.name || 'package'}” to {saved.no} ·{' '}
        <Link to={`/admin/projects/${saved.id}`}>Open the record</Link>
      </>
    );
  };

  // :13951-13953 — the modal's title
  const title = custom ? 'Custom proposal' : id ? 'Edit package' : 'New package';

  if (!draft) {
    return (
      <DeskPage title={title}>
        {error ? <DeskBanner>{error}</DeskBanner> : <p className="dz-state">Loading…</p>}
      </DeskPage>
    );
  }

  const lineName = (svcId: string) => (catalogue ? svcName(catalogue, svcId) : '…');

  return (
    <DeskPage title={title}>
      <div className="dzp">
        {error && <DeskBanner>{error}</DeskBanner>}
        {conflict && (
          <DeskBanner>
            {CONFLICT}{' '}
            <button
              type="button"
              className="dzp-btn sm"
              onClick={() => {
                setConflict(false);
                void load();
              }}
            >
              Reload
            </button>
          </DeskBanner>
        )}
        {svcWalk.error && <DeskBanner>{svcWalk.error}</DeskBanner>}
        {note && (
          <p className="dzp-mut" role="status">
            {note}
          </p>
        )}

        {/* :13972-13973 */}
        <div className="dzp-form">
          <label className="full">
            <span className="fl">Package name</span>
            <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
          </label>
          <label className="full">
            <span className="fl">Purpose</span>
            <input
              value={draft.purpose}
              onChange={(e) => patch({ purpose: e.target.value })}
            />
          </label>
        </div>

        {/* :13974 — service lines */}
        <div style={{ marginTop: 12 }}>
          <div className="dzp-fl">Service lines</div>
          {draft.lines.length ? (
            draft.lines.map((l, i) => (
              <div className="dzp-line" key={`${l.svcId}-${i}`}>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--ink)' }}>
                  {lineName(l.svcId)}
                </span>
                <input
                  inputMode="numeric"
                  aria-label="Count"
                  value={l.count}
                  style={{ flex: '0 0 auto', width: 58 }}
                  onChange={(e) =>
                    patch({
                      lines: draft.lines.map((x, j) =>
                        j === i ? { ...x, count: e.target.value } : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="dzp-btn sm gho dgr"
                  aria-label="Remove line"
                  onClick={() => patch({ lines: draft.lines.filter((_, j) => j !== i) })}
                >
                  ✕
                </button>
              </div>
            ))
          ) : (
            <div className="dzp-mut">No service lines yet.</div>
          )}
          <div className="dzp-acts">
            {/* :13960 — the menu resets itself after each pick */}
            <select
              className="dzp-sel"
              aria-label="Add a service line"
              value=""
              onChange={(e) => {
                if (e.target.value)
                  patch({ lines: [...draft.lines, { svcId: e.target.value, count: '1' }] });
              }}
            >
              <option value="">＋ Add a service line…</option>
              {groups.map((g) => (
                <optgroup key={g.cat} label={g.label}>
                  {g.rows.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {catalogue && catalogue.length === 0 && (
              <span className="dzp-mut">
                No services in the catalogue yet —{' '}
                <Link to="/admin/projects/packages?catalogue=1">add them</Link> first.
              </span>
            )}
          </div>
        </div>

        {/* :13975 — counts */}
        <div style={{ marginTop: 12 }}>
          <div className="dzp-fl">Counts</div>
          <div className="dzp-form">
            {COUNT_KEYS.map((k) => (
              <label key={k}>
                <span className="fl">{COUNT_LABELS[k]}</span>
                <input
                  inputMode="numeric"
                  value={draft.counts[k]}
                  onChange={(e) => patch({ counts: { ...draft.counts, [k]: e.target.value } })}
                />
              </label>
            ))}
            <label className="dzp-chk" style={{ alignSelf: 'end' }}>
              <input
                type="checkbox"
                checked={draft.onsite}
                onChange={(e) => patch({ onsite: e.target.checked })}
              />{' '}
              On-site production
            </label>
          </div>
        </div>

        {/* :13976 — the text fields */}
        <div style={{ marginTop: 12 }}>
          <div className="dzp-form">
            {TEXT_FIELDS.map((f) => (
              <label key={f.key} className={f.full ? 'full' : undefined}>
                <span className="fl">{f.label}</span>
                <input
                  value={draft[f.key]}
                  onChange={(e) => patch({ [f.key]: e.target.value })}
                />
              </label>
            ))}
          </div>
        </div>

        {/* :13968, :13977 — optional add-ons */}
        <div style={{ marginTop: 12 }}>
          <div className="dzp-fl">Optional add-ons</div>
          {draft.addons.length ? (
            draft.addons.map((a, i) => (
              <div className="dzp-line" key={i}>
                <input
                  value={a.name}
                  placeholder="Add-on"
                  aria-label="Add-on"
                  onChange={(e) =>
                    patch({
                      addons: draft.addons.map((x, j) =>
                        j === i ? { ...x, name: e.target.value } : x,
                      ),
                    })
                  }
                />
                <input
                  inputMode="decimal"
                  value={a.price}
                  placeholder="0"
                  aria-label="Price"
                  style={{ flex: '0 0 auto', width: 80 }}
                  onChange={(e) =>
                    patch({
                      addons: draft.addons.map((x, j) =>
                        j === i ? { ...x, price: e.target.value } : x,
                      ),
                    })
                  }
                />
                <select
                  value={a.currency}
                  aria-label="Currency"
                  style={{ flex: '0 0 auto', width: 82 }}
                  onChange={(e) =>
                    patch({
                      addons: draft.addons.map((x, j) =>
                        j === i ? { ...x, currency: e.target.value } : x,
                      ),
                    })
                  }
                >
                  {currencies.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.value}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="dzp-btn sm gho dgr"
                  aria-label="Remove add-on"
                  onClick={() => patch({ addons: draft.addons.filter((_, j) => j !== i) })}
                >
                  ✕
                </button>
              </div>
            ))
          ) : (
            <div className="dzp-mut">No add-ons.</div>
          )}
          <div className="dzp-acts">
            <button
              type="button"
              className="dzp-btn sm"
              onClick={() =>
                patch({ addons: [...draft.addons, { name: '', price: '', currency: cur }] })
              }
            >
              ＋ Add-on
            </button>
          </div>
        </div>

        {/* :13969, :13978 — payment stages */}
        <div style={{ marginTop: 12 }}>
          <div className="dzp-fl">Payment stages</div>
          {draft.payment_stages.length ? (
            draft.payment_stages.map((s, i) => (
              <div className="dzp-line" key={i}>
                <input
                  value={s.label}
                  placeholder="Stage"
                  aria-label="Stage"
                  onChange={(e) =>
                    patch({
                      payment_stages: draft.payment_stages.map((x, j) =>
                        j === i ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                />
                <input
                  inputMode="decimal"
                  value={s.pct}
                  placeholder="%"
                  aria-label="Percent"
                  style={{ flex: '0 0 auto', width: 64 }}
                  onChange={(e) =>
                    patch({
                      payment_stages: draft.payment_stages.map((x, j) =>
                        j === i ? { ...x, pct: e.target.value } : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="dzp-btn sm gho dgr"
                  aria-label="Remove stage"
                  onClick={() =>
                    patch({ payment_stages: draft.payment_stages.filter((_, j) => j !== i) })
                  }
                >
                  ✕
                </button>
              </div>
            ))
          ) : (
            <div className="dzp-mut">No stages.</div>
          )}
          <div className="dzp-acts">
            <button
              type="button"
              className="dzp-btn sm"
              onClick={() =>
                patch({ payment_stages: [...draft.payment_stages, { label: '', pct: '' }] })
              }
            >
              ＋ Stage
            </button>
          </div>
        </div>

        {/* :13964-13966 — owner only */}
        {canMoney && (
          <div style={{ marginTop: 6 }}>
            <div className="dzp-fl">Internal — owner / finance only</div>
            <div className="dzp-form">
              {INTERNAL_KEYS.map((k) => (
                <label key={k}>
                  <span className="fl">{INTERNAL_LABELS[k]}</span>
                  <input
                    inputMode="decimal"
                    value={draft.internal[k]}
                    onChange={(e) =>
                      patch({ internal: { ...draft.internal, [k]: e.target.value } })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {/* :13981 — the footer */}
        <div className="dzp-acts" style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <button
            type="button"
            className="dzp-btn gho"
            disabled={busy}
            onClick={() => navigate('/admin/projects/packages')}
          >
            Cancel
          </button>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* :13981 `proposalFromEditor` — no bare-draft preview on this
                API; the Apply path ends on the record that issues it */}
            <button
              type="button"
              className="dzp-btn"
              disabled={busy}
              onClick={() => void applyToProject()}
            >
              Preview proposal
            </button>
            <button
              type="button"
              className="dzp-btn"
              disabled={busy}
              onClick={() => void applyToProject()}
            >
              Apply to project
            </button>
            <button
              type="button"
              className="dzp-btn pri"
              disabled={busy}
              onClick={() => void save(false)}
            >
              {custom ? 'Save as template' : 'Save package'}
            </button>
          </div>
        </div>
        {/* stated mechanics — :14001 applied the unsaved draft as a snapshot
            and :13981's preview rendered it; this API links a project to a
            saved template and issues the proposal from the project's record */}
        <p className="dzp-mut" role="note">
          Apply to project · saves {custom ? 'this proposal as a template' : 'the package'}{' '}
          first — the API links a project to a saved template — then asks which project.
          Preview proposal · takes the same path: the proposal issues from that project’s
          record, not from a bare template.
        </p>

        {applyOpen && pkg && (
          <ProjectPick
            prompt="Apply this proposal to which project?" // :14001
            actionLabel="Apply"
            onPick={applyTo}
            onCancel={() => setApplyOpen(false)}
          />
        )}
      </div>
    </DeskPage>
  );
}
