/**
 * ProjectsCalculatorPage — `/admin/projects/calculator`, the pricing
 * calculator (`DZProjects.calc` / `_calcRes` / `calcLive` / `calcH` /
 * `calcP` / `calcScale` / `calcField` / `calcToggleClient` /
 * `calcSaveToProject`, `darz-studio.html:15303-15358`) over
 * `GET /projects/admin/service-catalog/` and `PATCH …/projects/{id}/`.
 *
 * Ported content:
 *  - the role gate (:15304): a standard admin sees the "Owner & finance
 *    only" card, verbatim, and nothing else;
 *  - the two-column layout (:15320-15325): inputs on the left, the sticky
 *    result on the right with "Result · CUR", the "Client quote view"
 *    toggle (:15322) and "Save to project";
 *  - the "Discount, deposit & final" inputs (:15316-15318) with their
 *    labels and the `calcInit` defaults (:13257 — discount 0, deposit 50,
 *    approved price blank);
 *  - the result rows (:15327-15351): the internal view's Recommended
 *    price, Discount (when set), Approved price (big, highlighted), Gross
 *    profit, Margin, Deposit (N%), On delivery; the client view's
 *    "Client quote — internal cost and margin omitted." line, Client
 *    price, Discount, Deposit, On delivery and Scope;
 *  - "Save to project" (:15358): the project pick, the money blob
 *    `quoteToMoney` builds and "Quote saved to no".
 *
 * Mechanics that changed — D21, the service catalogue IS the rate card:
 *  - the old CALCV priced hours × hourly rates, production costs, scale
 *    counts and ten multipliers from a client-side rate card in
 *    localStorage (`rateLoad`, :15305; `projPricingCalc`, :13358) that
 *    has no backend. The Hours / Production costs / Scale sections
 *    (:15307-15311), the multipliers card (:15321) and the rate-card
 *    editor (`rateEditor` / `rateSet` / `saveRate`, :15359-15377) are
 *    therefore not ported. The calculator prices from catalogue rows
 *    instead: every service line with a quantity (0 = not included), its
 *    price the recommended price and its internal cost the cost
 *    (`calcQuote`). The result rows that only the old model produced
 *    (Internal labour, External production, Base cost, Contingency, Total
 *    expected cost, Minimum acceptable, Multipliers, :15337-15343) are
 *    replaced by the one Internal cost row; the client view's Scope
 *    (:15335, the scale counts) is the included lines' names;
 *  - the catalogue is read whole (`per_page: 100`, `has_next` walked); an
 *    empty one is a stated note with a link to the catalogue;
 *  - the currency is the catalogue's when every included line agrees,
 *    else the default (`projDefCur()`, :15305), and mixed lines are said so;
 *  - the save is `PATCH …/projects/{id}/ {money, expected_version}`; the
 *    project's invoice status is kept (:15358 `if(!invoiceStatus)`); a 409
 *    is the conflict banner with Reload;
 *  - `Lib.toast` lines are inline status notes.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useOptions, useSession } from '../../../api/hooks';
import type { Choice, ProjectAdmin, ServiceCatalogItemAdmin } from '../../../api/types';
import { asAdminRole } from '../adminNav';
import { DeskBanner, DeskPage } from '../kit';
import { ProjectPick } from './PackagesPage';
import {
  asMoney,
  calcQuote,
  choices,
  defaultCurrency,
  projMoney,
  projN,
  quoteToMoney,
  svcName,
  walkServices,
  type PackageLine,
  type Quote,
} from './projectForm';
import '../admin.css';

/** The catalogue per `projects.service_category`, in option order (the
 * old `sec()` blocks, :15320); an unlisted category still shows. */
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

/* :15322 — the result head's label carried its own inline style */
const RESULT_LABEL = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  color: 'var(--ink3)',
} as const;

export function ProjectsCalculatorPage() {
  const { projectsAdmin } = useApi();
  const options = useOptions();
  const { me } = useSession();
  const canMoney = asAdminRole(me?.role) === 'owner'; // projCanMoney(), :15304
  const categories = choices(options, 'projects.service_category');
  const defCur = defaultCurrency(options); // projDefCur(), :15305

  // the catalogue — the rate card (D21); read only for the owner
  const [svcWalk, setSvcWalk] = useState<{
    rows: ServiceCatalogItemAdmin[] | null;
    error: string | null;
  }>({ rows: null, error: null });
  useEffect(() => {
    if (!canMoney) return;
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
  }, [projectsAdmin, canMoney]);
  const catalogue = useMemo(() => svcWalk.rows ?? [], [svcWalk.rows]);

  // CALCV (:13257) — quantities per catalogue line replace hours/prod/scale
  const [qty, setQty] = useState<Record<string, string>>({});
  const [discountPct, setDiscountPct] = useState('0');
  const [depositPct, setDepositPct] = useState('50');
  const [approvedPrice, setApprovedPrice] = useState('');
  const [client, setClient] = useState(false); // CALCV.client (:15322)
  const [saveOpen, setSaveOpen] = useState(false);

  // the included lines: every catalogue row with a quantity above 0
  const lines = useMemo<PackageLine[]>(
    () =>
      catalogue
        .filter((s) => projN(qty[s.id]) > 0)
        .map((s) => ({ svcId: s.id, count: projN(qty[s.id]) })),
    [catalogue, qty],
  );
  // the currency: the lines' own when they agree, else the default
  const lineCurrencies = useMemo(() => {
    const set = new Set<string>();
    for (const l of lines) {
      const c = catalogue.find((s) => s.id === l.svcId)?.currency;
      if (c) set.add(c);
    }
    return [...set];
  }, [lines, catalogue]);
  const mixed = lineCurrencies.length > 1;
  const cur = lineCurrencies.length === 1 ? lineCurrencies[0] : defCur;

  const quote: Quote = calcQuote(lines, catalogue, { discountPct, approvedPrice, depositPct });
  // :15329 / :15335 — the client view's Scope: the included lines
  const scopeText = lines
    .map((l) => (l.count > 1 ? `${l.count}× ` : '') + svcName(catalogue, l.svcId))
    .join(' · ');

  /** `calcSaveToProject` (:15358) — the pick calls it with the click
   * moment, which stamps the two payment ids. */
  const saveTo = async (project: ProjectAdmin, now: number) => {
    const money = {
      ...quoteToMoney(quote, cur, now),
      // :15358 — `if(!r.money.invoiceStatus) … 'none'`: an existing status stays
      invoiceStatus: asMoney(project.money, cur).invoiceStatus,
    };
    const saved = await projectsAdmin.updateProject(project.id, {
      money,
      expected_version: project.version,
    });
    return (
      // :15358 — the toast, plus the record
      <>
        Quote saved to {saved.no} ·{' '}
        <Link to={`/admin/projects/${saved.id}`}>Open the record</Link>
      </>
    );
  };

  // :15304 — the gate, verbatim
  if (!canMoney) {
    return (
      <DeskPage title="Calculator">
        <div className="dzp">
          <div className="dzp-ph">
            <h2>Owner &amp; finance only</h2>
            <p>
              The pricing calculator, rate card and margins are visible only to authorised
              roles.
            </p>
          </div>
        </div>
      </DeskPage>
    );
  }

  const groups = groupByCategory(catalogue, categories);
  const loading = svcWalk.rows === null && !svcWalk.error;

  return (
    <DeskPage title="Calculator">
      {/* adapted from :15324 — the hours / production / scale / multiplier
          inputs priced from a client-side rate card; the catalogue prices now */}
      <p className="ad-desksub">
        Service lines from the catalogue × quantities → cost and recommended price; discount,
        deposit and a final approved price. Internal cost and margin are shown here and omitted
        from the client quote view.
      </p>

      <div className="dzp">
        {svcWalk.error && <DeskBanner>{svcWalk.error}</DeskBanner>}
        {loading && <p className="dz-state">Loading…</p>}

        {!loading && (
          <div className="dzp-calc">
            {/* :15320 — the left column */}
            <div>
              {catalogue.length === 0 && !svcWalk.error && (
                <div className="dzp-empty" style={{ marginBottom: 14 }}>
                  No services in the catalogue yet — add them under{' '}
                  <Link to="/admin/projects/packages?catalogue=1">
                    Packages › Service catalogue
                  </Link>
                  .
                </div>
              )}
              {groups.map((g) => (
                <div key={g.cat} style={{ marginBottom: 14 }}>
                  <div className="dzp-fl">{g.label}</div>
                  <div className="dzp-form">
                    {g.rows.map((s) => (
                      // :15306 `hourRow` — the rate sits in the label
                      <label key={s.id}>
                        <span className="fl">
                          {s.name}{' '}
                          <span className="dzp-mut">
                            · {projMoney(s.price, s.currency || defCur)}/{s.unit || 'piece'} ·
                            cost {projMoney(s.internal_cost, s.currency || defCur)}
                          </span>
                        </span>
                        <input
                          inputMode="numeric"
                          placeholder="0"
                          value={qty[s.id] ?? ''}
                          onChange={(e) => setQty({ ...qty, [s.id]: e.target.value })}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {/* :15315-15319 */}
              <div style={{ marginBottom: 14 }}>
                <div className="dzp-fl">Discount, deposit &amp; final</div>
                <div className="dzp-form">
                  <label>
                    <span className="fl">Discount %</span>
                    <input
                      inputMode="decimal"
                      value={discountPct}
                      onChange={(e) => setDiscountPct(e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="fl">Deposit %</span>
                    <input
                      inputMode="decimal"
                      value={depositPct}
                      onChange={(e) => setDepositPct(e.target.value)}
                    />
                  </label>
                  <label className="full">
                    <span className="fl">
                      Final approved price (blank = recommended − discount)
                    </span>
                    <input
                      inputMode="decimal"
                      value={approvedPrice}
                      onChange={(e) => setApprovedPrice(e.target.value)}
                    />
                  </label>
                </div>
              </div>

              {/* replaces the multipliers card (:15321) — D21 */}
              <div className="dzp-darz">
                <div className="h">
                  Rate card · the service catalogue’s prices and internal costs are the rates
                  (D21)
                </div>
                <p>
                  {lines.length
                    ? lines
                        .map((l) => {
                          const s = catalogue.find((x) => x.id === l.svcId);
                          return `${l.count}× ${svcName(catalogue, l.svcId)} @ ${projMoney(s?.price, s?.currency || defCur)}`;
                        })
                        .join(' · ')
                    : 'No lines included yet — set a quantity above.'}
                </p>
                <div className="dzp-acts">
                  <Link className="dzp-btn sm" to="/admin/projects/packages?catalogue=1">
                    Edit the catalogue
                  </Link>
                </div>
              </div>
            </div>

            {/* :15322 — the sticky result */}
            <div className="dzp-res">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <div className="fl" style={RESULT_LABEL}>
                  Result · {cur}
                </div>
                <button
                  type="button"
                  className={`dzp-tog${client ? ' on' : ''}`}
                  aria-pressed={client}
                  onClick={() => setClient(!client)}
                >
                  Client quote view
                </button>
              </div>
              {mixed && (
                <p className="dzp-mut" role="note" style={{ marginBottom: 8 }}>
                  The included lines mix currencies ({lineCurrencies.join(', ')}) — the totals
                  add them in {cur} without conversion.
                </p>
              )}
              <div>
                {client ? (
                  // :15330-15335
                  <>
                    <div className="dzp-mut" style={{ marginBottom: 8 }}>
                      Client quote — internal cost and margin omitted.
                    </div>
                    <ResRow label="Client price" value={projMoney(quote.approved, cur)} big />
                    {quote.discountPct ? (
                      <ResRow label="Discount" value={`${quote.discountPct}%`} />
                    ) : null}
                    <ResRow
                      label={`Deposit (${Math.round(quote.depositPct)}%)`}
                      value={projMoney(quote.deposit, cur)}
                    />
                    <ResRow label="On delivery" value={projMoney(quote.remaining, cur)} />
                    {scopeText && <ResRow label="Scope" value={scopeText} plain />}
                  </>
                ) : (
                  // :15337-15350, on catalogue lines (D21)
                  <>
                    <ResRow label="Internal cost" value={projMoney(quote.internal, cur)} />
                    <ResRow label="Recommended price" value={projMoney(quote.price, cur)} />
                    {quote.discountPct ? (
                      <ResRow label="Discount" value={`${quote.discountPct}%`} />
                    ) : null}
                    <ResRow
                      label="Approved price"
                      value={projMoney(quote.approved, cur)}
                      big
                    />
                    <ResRow label="Gross profit" value={projMoney(quote.gross, cur)} />
                    <ResRow label="Margin" value={`${Math.round(quote.margin * 10) / 10}%`} />
                    <ResRow
                      label={`Deposit (${Math.round(quote.depositPct)}%)`}
                      value={projMoney(quote.deposit, cur)}
                    />
                    <ResRow label="On delivery" value={projMoney(quote.remaining, cur)} />
                  </>
                )}
              </div>
              <div className="dzp-acts" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="dzp-btn pri sm"
                  aria-expanded={saveOpen}
                  onClick={() => setSaveOpen(!saveOpen)}
                >
                  Save to project
                </button>
              </div>
              {saveOpen && (
                <ProjectPick
                  prompt="Save this quote to which project?" // :15358
                  actionLabel="Save to project"
                  onPick={saveTo}
                  onCancel={() => setSaveOpen(false)}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </DeskPage>
  );
}

/** One `.rr` of `_calcRes` (:15331-15350); `big` is the `.big.hi` approved
 * line, `plain` the Scope row's unweighted value (:15335). */
function ResRow({
  label,
  value,
  big,
  plain,
}: {
  label: string;
  value: string;
  big?: boolean;
  plain?: boolean;
}) {
  return (
    <div className={`rr${big ? ' big hi' : ''}`}>
      <span>{label}</span>
      <b style={plain ? { fontWeight: 400 } : undefined}>{value}</b>
    </div>
  );
}
