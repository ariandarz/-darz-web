/**
 * ProjectReportPage — `/admin/projects/:id/report` (`?client=1` for the
 * client version), the print-ready project report (`DZProjects.report` /
 * `_reportDoc`, `darz-studio.html:15482-15524`).
 *
 * The old opened a new window and wrote a self-contained HTML document into
 * it (:15486; the v1184 `DarzPDF.preview` when present, :15485). Here the
 * document is a route: the same markup (:15506-15523) under a `.dzp-report`
 * wrapper with the old stylesheet (:15499-15505) inlined and scoped to it —
 * a light print document, not a desk, so no DeskPage and none of the panel's
 * tokens; the families it names are the ones index.html already loads.
 *
 * Ported content: the seam, the wordmark, the eyebrow (report kind · no),
 * the name, the meta line (client · city · category · stage), "Print / Save
 * as PDF" (`window.print()`, hidden in print), then Scope, "Scope by
 * category" (:15494 — with its note, only when the applied package has
 * lines), Deliverables (text — due, ✓ when done), Partners (org — role:
 * deliverables), "Financials — internal" (:15492-15493, owner + internal
 * only), Results, Report, "Media & publication", "Internal notes" (owner +
 * internal only). The document title as :15506, set in an effect.
 *
 * Mechanics that changed:
 *  - the project, its applied package (when set), the service catalogue
 *    (for `scopeByCat`) and the partner orgs (`projOrgName`, :13297) are
 *    fetched; the old read them from memory. A lane's org name resolves
 *    from the project's own `partner_orgs` mirror first, then the partners
 *    list, else '—' (:15497);
 *  - `projCanMoney()` (:13282) is the owner role. A standard admin opening
 *    the internal URL gets the CLIENT version throughout — eyebrow, title
 *    and content — and a line (not printed) says so; the old never showed
 *    that login the internal button (:15455), so this case is new;
 *  - stage / category / service-category labels come from `useOptions`;
 *  - the scope table's currency is the catalogue's (the first line's
 *    service), else the options' default — in place of the old
 *    `projDefCur()` (:15494), kept in step with ProjectProposal.tsx;
 *  - a "← Back to the project" link (not printed) replaces closing the
 *    window; in print this page's own stylesheet hides the admin shell's two
 *    navbar rows, so the printed page is the document alone, as the old
 *    window was;
 *  - the base reset zeroes every margin, so the `p` / `ul` spacing the old
 *    document took from the browser's defaults is restored in the block.
 * Not ported: the pop-up-blocker toasts (:15486) and the DarzPDF preview
 * toolbar with its Download PDF (:15485) — the browser's print dialog saves
 * the PDF.
 */
import { Fragment, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useApi, useOptions, useSession } from '../../../api/hooks';
import type { ProjectsAdminService } from '../../../api/services';
import type {
  PackageTemplateAdmin,
  Paginated,
  PartnerOrgAdmin,
  ProjectAdmin,
  ServiceCatalogItemAdmin,
} from '../../../api/types';
import { asAdminRole } from '../adminNav';
import { DeskBanner } from '../kit';
import {
  PROJ_ROLES,
  asDeliverables,
  asLanes,
  asLinks,
  asPackageLines,
  choiceLabel,
  choices,
  defaultCurrency,
  moneyCalc,
  projMoney,
  scopeByCat,
  stageLabel,
} from './projectForm';
import '../admin.css';

/* :15499-15505 — the old document's stylesheet, its values verbatim, scoped
   to the wrapper (the old styled a whole window's `body`); the button's
   inline style (:15513) joins it, `p`/`ul` get the browser margins the base
   reset removes, and in print the shell's navbar rows go with `.noprint`. */
const REPORT_CSS = `
.dzp-report{margin:0;font-family:Barlow,Helvetica,Arial,sans-serif;color:#1a1a1a;background:#fff;padding:0 0 60px}
.dzp-report .seam{height:3px;background:linear-gradient(90deg,#00D4CC,#E8005C)}
.dzp-report .wrap{max-width:760px;margin:0 auto;padding:34px 26px}
.dzp-report .wm{font-family:"Cormorant Garamond",Palatino,serif;font-size:14px;letter-spacing:.02em;color:#0A0A0A}
.dzp-report .eyebrow{font-size:9px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#9A9A9A;margin:22px 0 4px}
.dzp-report h1{font-family:"Cormorant Garamond",Palatino,serif;font-size:34px;font-weight:600;margin:2px 0 4px;color:#0A0A0A}
.dzp-report h2{font-family:"Cormorant Garamond",Palatino,serif;font-size:20px;font-weight:600;margin:26px 0 8px;color:#0A0A0A;border-top:1px solid #EBEBEB;padding-top:14px}
.dzp-report p{font-size:13px;line-height:1.6;color:#3C3C3C;margin:1em 0}
.dzp-report .mut{color:#9A9A9A}
.dzp-report ul{padding-left:18px;margin:1em 0}
.dzp-report li{font-size:13px;line-height:1.7;color:#3C3C3C}
.dzp-report table{width:100%;border-collapse:collapse;margin-top:8px}
.dzp-report th,.dzp-report td{border:1px solid #EBEBEB;padding:7px 9px;font-size:12px;text-align:left}
.dzp-report th{background:#FAFAFA;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:#3C3C3C}
.dzp-report .meta{font-size:12px;color:#3C3C3C}
.dzp-report .noprint{margin:18px 0;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.dzp-report .noprint button{font:inherit;font-size:12px;padding:9px 16px;border:1px solid #0A0A0A;background:#0A0A0A;color:#fff;border-radius:8px;cursor:pointer}
.dzp-report .noprint a{font-size:12px;color:#3C3C3C}
.dzp-report .noprint .mut{font-size:12px}
@media print{.dzp-report .noprint,.ad-top,.ad-subtabs{display:none}}
`;

/** Everything the document reads, fetched once per visit. */
interface Loaded {
  project: ProjectAdmin;
  pkg: PackageTemplateAdmin | null;
  catalog: ServiceCatalogItemAdmin[];
  partners: PartnerOrgAdmin[];
}

/** Every page of a list (no filter narrows these). */
async function walk<T>(fetchPage: (page: number) => Promise<Paginated<T>>): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  for (;;) {
    const res = await fetchPage(page);
    out.push(...res.results);
    if (!res.pagination.has_next) return out;
    page += 1;
  }
}

async function loadReport(api: ProjectsAdminService, id: string): Promise<Loaded> {
  const project = await api.project(id);
  const applied = project.applied_package;
  const [pkg, catalog, partners] = await Promise.all([
    // the package may be gone since it was applied — the report still prints
    applied ? api.packageTemplate(applied).catch(() => null) : Promise.resolve(null),
    applied
      ? walk((page) => api.services({ page, per_page: 100 }))
      : Promise.resolve([] as ServiceCatalogItemAdmin[]),
    walk((page) => api.partners({ page, per_page: 100 })),
  ]);
  return { project, pkg, catalog, partners };
}

/** `projClientName` (:13298): the linked org's name, else the typed one. */
function clientName(p: ProjectAdmin): string {
  return p.client_partner_org?.name || p.client_name || '';
}

/** `projRoleLabel` (:13331) — the dash fallback. */
const roleLabel = (r: string): string => choiceLabel(PROJ_ROLES, r) || '—';

export function ProjectReportPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { projectsAdmin } = useApi();
  const options = useOptions();
  const { me } = useSession();

  const client = params.get('client') === '1';
  const canMoney = asAdminRole(me?.role) === 'owner'; // projCanMoney(), :13282
  const showMoney = canMoney && !client; // :15488
  // a standard admin on the internal URL reads the client version throughout
  const clientView = client || !canMoney;

  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  // a promise chain (the `useOptions` shape): state is set in the settle
  // callbacks, never synchronously inside the effect
  useEffect(() => {
    let alive = true;
    loadReport(projectsAdmin, id).then(
      (d) => alive && setData(d),
      (err: unknown) =>
        alive && setError(err instanceof Error ? err.message : 'Could not load the report.'),
    );
    return () => {
      alive = false;
    };
  }, [projectsAdmin, id]);

  // :15506 — the window's title; the previous one comes back on leaving
  const name = data?.project.name;
  useEffect(() => {
    if (!data) return;
    const prev = document.title;
    document.title = (name || 'Project report') + (clientView ? '' : ' · internal');
    return () => {
      document.title = prev;
    };
  }, [data, name, clientView]);

  const stages = choices(options, 'projects.stage');
  const categories = choices(options, 'projects.category');
  const serviceCategories = choices(options, 'projects.service_category');

  if (!data || !options) {
    return (
      <div className="dzp-report">
        <style>{REPORT_CSS}</style>
        <div className="seam" />
        <div className="wrap">
          <div className="wm">darzmarket.art</div>
          {error ? <DeskBanner>{error}</DeskBanner> : <p className="dz-state">Loading…</p>}
          <div className="noprint">
            <Link to={`/admin/projects/${id}`}>← Back to the project</Link>
          </div>
        </div>
      </div>
    );
  }

  const { project: p, pkg, catalog, partners } = data;
  const defCur = defaultCurrency(options);

  // :15494 — the scope table, only for an applied package with lines
  const lines = pkg ? asPackageLines(pkg.lines) : [];
  const scopeRows = lines.length ? scopeByCat(lines, catalog, serviceCategories) : null;
  const firstSvc = lines
    .map((l) => catalog.find((s) => s.id === l.svcId))
    .find((s) => s !== undefined);
  const scur = firstSvc?.currency || defCur;

  const dels = asDeliverables(p.deliverables); // :15495
  const mlinks = asLinks(p.media_links); // :15496
  const lanes = asLanes(p.partner_roles); // :15497
  const mc = moneyCalc(p, defCur); // :15490

  /** `projOrgName` (:13297) — the project's own mirror first, then the list. */
  const orgName = (orgId: string): string =>
    p.partner_orgs.find((x) => x.id === orgId)?.name ||
    partners.find((o) => o.id === orgId)?.name ||
    '';

  return (
    <div className="dzp-report">
      <style>{REPORT_CSS}</style>
      {/* :15508 */}
      <div className="seam" />
      <div className="wrap">
        <div className="wm">darzmarket.art</div>
        {/* :15509 */}
        <div className="eyebrow">
          {clientView ? 'Project report' : 'Project report · internal'} · {p.no}
        </div>
        <h1>{p.name || 'Project'}</h1>
        {/* :15510 */}
        <p className="meta">
          {clientName(p)}
          {p.city ? ` · ${p.city}` : ''} · {choiceLabel(categories, p.category) || '—'} ·{' '}
          {stageLabel(stages, p.stage)}
        </p>
        {/* :15513 — the standalone page's own Print button; the Back link is
            this route's way out of the document */}
        <div className="noprint">
          <button type="button" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
          <Link to={`/admin/projects/${id}`}>← Back to the project</Link>
          {!canMoney && !client && (
            <span className="mut">
              The internal report is for the owner login — this is the client version.
            </span>
          )}
        </div>

        {/* :15514 */}
        {p.scope && (
          <>
            <h2>Scope</h2>
            <p>{p.scope}</p>
          </>
        )}

        {/* :15494 */}
        {scopeRows && (
          <>
            <h2>Scope by category</h2>
            <p className="mut">
              Every category is either included with its fee, or available as a paid addition —
              curatorial work is always priced, never bundled invisibly.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Services &amp; fees</th>
                </tr>
              </thead>
              <tbody>
                {scopeRows.map((s) => (
                  <tr key={s.cat}>
                    <td>{s.label}</td>
                    <td>{s.included ? 'Included' : 'Available as a paid addition'}</td>
                    <td>
                      {s.items.length
                        ? s.items.map((it, i) => (
                            <Fragment key={`${it.name}-${i}`}>
                              {i > 0 && <br />}
                              {(it.count > 1 ? `${it.count}× ` : '') + it.name} —{' '}
                              {projMoney(it.price * (it.count || 1), scur)}
                            </Fragment>
                          ))
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* :15516 */}
        <h2>Deliverables</h2>
        <ul>
          {dels.length ? (
            dels.map((d, i) => (
              <li key={d.id || i}>
                {d.text}
                {d.due ? (
                  <>
                    {' — '}
                    <span className="mut">{d.due}</span>
                  </>
                ) : null}
                {d.done ? ' ✓' : ''}
              </li>
            ))
          ) : (
            <li className="mut">—</li>
          )}
        </ul>

        {/* :15517 */}
        {lanes.length > 0 && (
          <>
            <h2>Partners</h2>
            <ul>
              {lanes.map((x, i) => (
                <li key={`${x.orgId}-${i}`}>
                  <b>{orgName(x.orgId) || '—'}</b> — {roleLabel(x.role)}
                  {x.deliverables ? `: ${x.deliverables}` : ''}
                </li>
              ))}
            </ul>
          </>
        )}

        {/* :15492-15493, :15518 */}
        {showMoney && (
          <>
            <h2>Financials — internal</h2>
            <table>
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>Client price</th>
                  <th>Fee</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {mc.currencies.length ? (
                  mc.currencies.map((c) => {
                    const b = mc.byCur[c];
                    return (
                      <tr key={c}>
                        <td>{c}</td>
                        <td>{projMoney(b.client, c)}</td>
                        <td>{projMoney(b.fee, c)}</td>
                        <td>{projMoney(b.internal + b.external, c)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4}>No amounts recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* :15519-15520 */}
        {p.results && (
          <>
            <h2>Results</h2>
            <p>{p.results}</p>
          </>
        )}
        {p.report && (
          <>
            <h2>Report</h2>
            <p>{p.report}</p>
          </>
        )}

        {/* :15521 */}
        {mlinks.length > 0 && (
          <>
            <h2>Media &amp; publication</h2>
            <ul>
              {mlinks.map((x, i) => (
                <li key={`${x.url}-${i}`}>
                  <a href={x.url || '#'}>{x.label || x.url}</a>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* :15498, :15522 */}
        {showMoney && p.internal_notes && (
          <>
            <h2>Internal notes</h2>
            <p>{p.internal_notes}</p>
          </>
        )}
      </div>
    </div>
  );
}
