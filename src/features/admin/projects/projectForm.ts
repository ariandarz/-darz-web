/**
 * projectForm — the Projects group's pure logic, ported from the old admin
 * panel's `DZProjects` module (`darz-studio.html` :13235-15534) and re-aimed
 * at the new backend (`apps/projects/`). Every page of the group imports its
 * guards, helpers, stage machinery, flags, quick filters, package/pricing
 * maths, proposal fields and old-UI vocabularies from here, so the desks can
 * never drift apart on a rule or a string.
 *
 * What changed for the new backend (each stated on screen by the pages):
 *
 *  - stage / status / category / service-category / currency LABELS come
 *    from `GET /api/options/` (`projects.stage` etc.), never from the old
 *    `PROJ_STAGES` table (:13235) — the option order IS the pipeline order.
 *    Only the vocabularies WITHOUT a backend enum stay here as content
 *    constants (partner roles, deliverable classes, dashboard card copy…).
 *  - `money.*.currency` is the backend key (the old blobs used `cur`, :13877);
 *    the guards read both so an old blob still renders.
 *  - `stages` (the per-stage sub-state) is writable since G-PROJ-3: the old
 *    `setStage` seeding (:13706-13714: the target stage's start date and
 *    checklist from its template, `doneTs` on every earlier stage) is
 *    `moveStages`, sent as a locked PATCH before the stage move itself.
 *    `scopeGate` still keys on stage ORDER (see its note).
 *  - the dashboard/list flags mirror the BACKEND's rules
 *    (`ProjectService._is_active/_is_delayed/_awaits_approval/_unpaid_count`,
 *    `services.py:208-232`) rather than the old :13315-13320 ones, so the
 *    tiles the server counts and the lists the client filters agree.
 *  - the calculator prices FROM the service catalogue (D21) — the old
 *    rate-card × hours model (`projPricingCalc`, :13358) is not ported.
 *
 * Every export is pure except `uid()` and `todayIso()`; every guard accepts
 * `unknown` and never throws.
 */
import type {
  Choice,
  PackageTemplateAdmin,
  PackageTemplateInput,
  ProjectAdmin,
  ProjectMoneyBucket,
  ProjectPatch,
  ProjectQuickFilter,
  ProjectTotals,
  ServiceCatalogItemAdmin,
} from '../../../api/types';
import type { OptionsMap, ProjectsAdminService } from '../../../api/services';
import type { DocumentPdfFields } from '../pdf/renderPdf';
import { fmtThousands } from '../../portal/portalForm';
import { walkPages } from '../../../api/paging';

export { fmtDate } from '../../portal/portalForm';

/* ── JSON field shapes (the old panel's own keys, kept by the backend) ──── */

/** :13882 — one deliverable row (`deliverables[]`). */
export interface Deliverable {
  id: string;
  text: string;
  due: string;
  owner: string;
  done: boolean;
  depId: string;
  doneTs?: number;
  doneBy?: string;
}

/** `{amount, currency}` — the backend's money key (old `cur`, :13877). */
export interface MoneyAmount {
  amount: string;
  currency: string;
}

/** :13879 — one payment-schedule stage. */
export interface PaymentStage {
  id: string;
  label: string;
  amount: string;
  currency: string;
  due: string;
  paid: boolean;
  paidTs?: number;
}

/** :13804 — the old UI's invoice vocabulary (no backend enum). */
export type InvoiceStatus = 'none' | 'draft' | 'sent' | 'partial' | 'paid';

export interface ProjectMoney {
  internalCost: MoneyAmount;
  externalCost: MoneyAmount;
  fee: MoneyAmount;
  clientPrice: MoneyAmount;
  payments: PaymentStage[];
  invoiceStatus: InvoiceStatus;
}

/** :13712 — a stage checklist row. */
export interface ChecklistItem {
  id: string;
  text: string;
  owner: string;
  due: string;
  done: boolean;
}

/** :13707 / :13710 — the per-stage sub-state (written by `moveStages`). */
export interface StageState {
  owner: string;
  start: string;
  due: string;
  deps: string[];
  files: string[];
  checklist: ChecklistItem[];
  intApproved?: boolean;
  cliApproved?: boolean;
  notes: string;
  doneTs: number;
}

/** Keyed by stage key. */
export type StageMap = Record<string, StageState>;

/** :13820-13846 — one partner's lane on a project (`partner_roles[orgId]`). */
export interface PartnerLane {
  orgId: string;
  role: string;
  delivClass: string;
  deliverables: string;
  deadline: string;
  contact: string;
  materials: string;
  ownership: string;
  channels: string;
  approval: string;
  budget: string;
  dependsOn: string;
  status: 'on-track' | 'at-risk' | 'done';
}

/** :13886 — `links[]` / `media_links[]`. */
export interface LinkRow {
  label: string;
  url: string;
}

/** :13987 — a package's service line ("service catalog item ids + quantities"). */
export interface PackageLine {
  svcId: string;
  count: number;
}

/** :13954 — the package's deliverable counts. */
export interface PackageCounts {
  posts: number;
  stories: number;
  articles: number;
  interviews: number;
  photos: number;
  videos: number;
  videoMin: number;
}

/** :13990 — an optional add-on. */
export interface PackageAddon {
  name: string;
  price: number;
  currency: string;
}

/** :13993 — a payment stage of a package (label + percentage). */
export interface PackagePaymentStage {
  label: string;
  pct: number;
}

/** :13954 `internal` — owner / finance only. */
export interface PackageInternal {
  internalCost: number;
  externalCost: number;
  minFee: number;
  recFee: number;
  targetMargin: number;
}

/* ── content constants (old-UI vocabularies with no backend enum) ───────── */

/** :13328 `PROJ_ROLES` — as `{value,label}` so `choiceLabel` reads them. */
export const PROJ_ROLES: Choice[] = [
  { value: 'media', label: 'Media partner' },
  { value: 'editorial', label: 'Editorial partner' },
  { value: 'content', label: 'Content partner' },
  { value: 'documentation', label: 'Documentation partner' },
  { value: 'curatorial', label: 'Curatorial partner' },
  { value: 'market', label: 'Market-intelligence partner' },
  { value: 'archive', label: 'Archive & research partner' },
];

/** :13329 `DELIV_CLASSES` — the blank first entry is the old "—" option. */
export const DELIV_CLASSES: Choice[] = [
  { value: '', label: '—' },
  { value: 'listing', label: 'Listings' },
  { value: 'social', label: 'Social amplification' },
  { value: 'editorial', label: 'Editorial writing' },
  { value: 'video', label: 'Video production' },
  { value: 'photography', label: 'Photography' },
  { value: 'curatorial', label: 'Curatorial framing' },
  { value: 'interview', label: 'Interviews' },
  { value: 'archive', label: 'Archive' },
  { value: 'distribution', label: 'Distribution' },
  { value: 'programming', label: 'Venue programming' },
];

/** :13631-13635 / :13646 — the dashboard → list quick filters. */
export const QUICK = ['active', 'delayed', 'approval', 'deliverables', 'unpaid'] as const;
export type Quick = (typeof QUICK)[number];

export function isQuick(v: unknown): v is Quick {
  return typeof v === 'string' && (QUICK as readonly string[]).includes(v);
}

/** :13646 `quickLbl` — the chip text over the filtered list. */
export const QUICK_LABELS: Record<Quick, string> = {
  active: 'Active',
  delayed: 'Delayed',
  approval: 'Awaiting approval',
  deliverables: 'Deliverables ≤7d',
  unpaid: 'Unpaid',
};

/** G-PROJ-1 — the quick filters the server applies (`?quick=`,
 * `ProjectService.apply_quick`, the same predicates as the dashboard counts).
 * `deliverables` has no server filter, so its list is still read whole and
 * filtered here (`matchesQuick`); null says so. */
export function serverQuick(q: Quick): ProjectQuickFilter | null {
  switch (q) {
    case 'active':
    case 'delayed':
    case 'unpaid':
      return q;
    case 'approval':
      return 'awaiting_approval';
    case 'deliverables':
      return null;
  }
}

export interface DashCard {
  q: Quick;
  /** the `.dzp-att` tone class: '' plain, 'a' amber, 'b' red (:13605-13610) */
  cls: '' | 'a' | 'b';
  k: string;
  d: string;
}

/** :13604-13610 — the dashboard cards, in order. The `unpaid` card was
 * pushed only for `projCanMoney()` (:13610); pages keep that gate. */
export const DASH_CARDS: DashCard[] = [
  {
    q: 'active',
    cls: '',
    k: 'Active projects',
    d: 'In flight right now, across every stage.',
  },
  { q: 'delayed', cls: 'b', k: 'Delayed', d: 'Past a stage deadline — needs attention.' },
  {
    q: 'approval',
    cls: 'a',
    k: 'Awaiting approval',
    d: 'Internal or client sign-off is pending.',
  },
  { q: 'deliverables', cls: '', k: 'Next deliverables', d: 'Due within the next 7 days.' },
  {
    q: 'unpaid',
    cls: 'a',
    k: 'Unpaid invoices',
    d: 'Deposits or invoices still outstanding.',
  },
];

/** :13849 — the `.dzp-darz` blurb under a project's Partners & roles. */
export const DARZ_ROLE_DETAIL = {
  h: 'Darz — differentiated role',
  p: 'Curatorial framing, editorial writing, interviews, market context, collector & institutional communication, English-language presentation and long-term archive — the value production studios, listing platforms and social pages cannot provide.',
} as const;

/** :15418 — the `.dzp-darz` blurb under a responsibility matrix. */
export const DARZ_ROLE_MATRIX = {
  h: 'Darz — differentiated role',
  p: 'Curatorial framing · editorial quality · artist & market research · interviews · exhibition interpretation · professional documentation · collector & institutional communication · international English presentation · long-term archive and discoverability · Darz-channel distribution and reporting — the value lifestyle media, production studios, listing platforms and social pages cannot provide.',
} as const;

/**
 * :15398 — the Partners desk's worked example. The old paragraph was HTML
 * (`<b>org</b> — role · …`); here it is structured so a page can render the
 * bold org names without `dangerouslySetInnerHTML`: the four `partners`
 * joined by ' · ', then '. ', then the `darz` lane, then '. ', then `note`.
 * `text` is the same paragraph flattened for anywhere plain text will do.
 */
export const VANAK_EXAMPLE = {
  h: 'Worked example · 13 Vanak',
  partners: [
    { org: 'Avaplat Studio', role: 'production & video' },
    { org: 'Kargah', role: 'venue programming' },
    { org: 'Peeyade', role: 'social amplification' },
    { org: 'Gallery Info', role: 'listings' },
  ],
  darz: {
    org: 'Darz',
    role: 'curatorial framing, editorial writing, interviews, market context, collector communication, English-language presentation and long-term archive',
  },
  note: 'Add each partner’s role on a project’s Partners section; the matrix below makes every lane explicit and flags any overlap.',
  text: 'Avaplat Studio — production & video · Kargah — venue programming · Peeyade — social amplification · Gallery Info — listings. Darz — curatorial framing, editorial writing, interviews, market context, collector communication, English-language presentation and long-term archive. Add each partner’s role on a project’s Partners section; the matrix below makes every lane explicit and flags any overlap.',
} as const;

/** :15414 — a partner lane's status vocabulary. */
export const LANE_STATUSES = ['on-track', 'at-risk', 'done'] as const;

/** :13804 — the money section's invoice-status `<select>`. */
export const INVOICE_STATUSES: InvoiceStatus[] = ['none', 'draft', 'sent', 'partial', 'paid'];

/** :13935 — a service line's unit `<select>`. */
export const UNITS = ['piece', 'hour', 'day'] as const;

/** :13317 — the stages whose approval flags the old panel read. */
export const REVIEW_STAGES = ['internalReview', 'clientReview', 'finalApproval'];

/** :13323 — the three stages a curatorial/mixed project must clear first. */
export const GATE_STAGES = ['scopeApproval', 'contract', 'deposit'];

/** The proposal's document series (`doc-reference.js` v1185 shape). */
export const PROPOSAL_SERIES = { code: 'PRO', label: 'Project proposal' } as const;

/* ── helpers (:13281-13294) ─────────────────────────────────────────────── */

const DAY_MS = 86400000; // :13285

const str = (v: unknown): string => (v == null ? '' : String(v));
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** :13284 — a number out of anything ("1,200 USD" → 1200; garbage → 0). */
export function projN(v: unknown): number {
  return Number(str(v).replace(/[^0-9.-]/g, '')) || 0;
}

/** :13288 — "1,200 USD" (rounded; the old `pdFmtC` detour is not ported). */
export function projMoney(n: unknown, cur?: string): string {
  return Math.round(projN(n)).toLocaleString('en-US') + (cur ? ' ' + cur : '');
}

/** :13283 — today as an ISO date (impure by nature). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** :13281 `projUid` — prefix + time (base 36) + 4 random chars. `now` lets a
 * caller that already holds a timestamp keep its ids sortable together. */
export function uid(prefix: string, now: number = Date.now()): string {
  return (prefix || 'p') + now.toString(36) + Math.random().toString(36).slice(2, 6);
}

/** :13876 `setList` — "a, b ,,c" → ['a','b','c']. */
export function parseList(csv: unknown): string[] {
  return str(csv)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

/** One `GET /api/options/` key as an ordered `Choice[]` ([] until loaded). */
export function choices(options: OptionsMap | null, key: string): Choice[] {
  const v = options?.[key];
  return Array.isArray(v) ? (v as Choice[]) : [];
}

/** `{value,label}` lookup falling back to the raw value (old `projCatLabel`
 * & friends returned `c||'—'`, :13292 — the dash is the page's call). */
export function choiceLabel(list: Choice[], value: string | null | undefined): string {
  if (!value) return '';
  return list.find((c) => c.value === value)?.label ?? value;
}

/** :13287 `projDefCur` — the first `currency` choice ('' before load). */
export function defaultCurrency(options: OptionsMap | null): string {
  return choices(options, 'currency')[0]?.value ?? '';
}

/* ── guards — accept `unknown`, never throw ─────────────────────────────── */

function asBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1;
}

/** `deliverables` (:13882 shape). Non-object rows are dropped. */
export function asDeliverables(u: unknown): Deliverable[] {
  if (!Array.isArray(u)) return [];
  const out: Deliverable[] = [];
  for (const x of u) {
    if (!isObj(x)) continue;
    const d: Deliverable = {
      id: str(x.id),
      text: str(x.text),
      due: str(x.due),
      owner: str(x.owner),
      done: asBool(x.done),
      depId: str(x.depId),
    };
    if (x.doneTs != null) d.doneTs = projN(x.doneTs);
    if (x.doneBy != null) d.doneBy = str(x.doneBy);
    out.push(d);
  }
  return out;
}

function asAmount(u: unknown, defaultCurrency: string): MoneyAmount {
  if (!isObj(u)) return { amount: '', currency: defaultCurrency };
  const raw = u.amount;
  const amount = typeof raw === 'number' ? String(raw) : str(raw).trim();
  // `currency` is the backend key; `cur` the old blob's (:13877)
  const currency = str(u.currency ?? u.cur) || defaultCurrency;
  return { amount, currency };
}

function asInvoiceStatus(u: unknown): InvoiceStatus {
  return typeof u === 'string' && (INVOICE_STATUSES as string[]).includes(u)
    ? (u as InvoiceStatus)
    : 'none';
}

/** `money` (backend description: internalCost/externalCost/fee/clientPrice
 * each {amount, currency}, payments[], invoiceStatus). */
export function asMoney(u: unknown, defaultCurrency: string): ProjectMoney {
  const m = isObj(u) ? u : {};
  const payments: PaymentStage[] = [];
  if (Array.isArray(m.payments))
    for (const p of m.payments) {
      if (!isObj(p)) continue;
      const a = asAmount(p, defaultCurrency);
      const row: PaymentStage = {
        id: str(p.id),
        label: str(p.label),
        amount: a.amount,
        currency: a.currency,
        due: str(p.due),
        paid: asBool(p.paid),
      };
      if (p.paidTs != null) row.paidTs = projN(p.paidTs);
      payments.push(row);
    }
  return {
    internalCost: asAmount(m.internalCost, defaultCurrency),
    externalCost: asAmount(m.externalCost, defaultCurrency),
    fee: asAmount(m.fee, defaultCurrency),
    clientPrice: asAmount(m.clientPrice, defaultCurrency),
    payments,
    invoiceStatus: asInvoiceStatus(m.invoiceStatus),
  };
}

function asChecklistItems(u: unknown): ChecklistItem[] {
  if (!Array.isArray(u)) return [];
  const out: ChecklistItem[] = [];
  for (const x of u) {
    if (isObj(x))
      out.push({
        id: str(x.id),
        text: str(x.text),
        owner: str(x.owner),
        due: str(x.due),
        done: asBool(x.done),
      });
    else if (typeof x === 'string' && x.trim())
      out.push({ id: '', text: x.trim(), owner: '', due: '', done: false });
  }
  return out;
}

/** `stages` (:13710 shape) — the typed read. `intApproved`/`cliApproved`
 * are kept only when they are real booleans, because the backend's
 * awaits-approval rule is a strict `is False` (`services.py:224`). */
export function asStages(u: unknown): StageMap {
  const out: StageMap = {};
  if (!isObj(u)) return out;
  for (const [k, v] of Object.entries(u)) {
    if (!isObj(v)) continue;
    const s: StageState = {
      owner: str(v.owner),
      start: str(v.start),
      due: str(v.due),
      deps: asStringList(v.deps),
      files: asStringList(v.files),
      checklist: asChecklistItems(v.checklist),
      notes: str(v.notes),
      doneTs: projN(v.doneTs),
    };
    if (typeof v.intApproved === 'boolean') s.intApproved = v.intApproved;
    if (typeof v.cliApproved === 'boolean') s.cliApproved = v.cliApproved;
    out[k] = s;
  }
  return out;
}

function blankLane(orgId: string): PartnerLane {
  return {
    orgId,
    role: '',
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
  };
}

function laneFrom(orgId: string, v: unknown): PartnerLane | null {
  if (typeof v === 'string') {
    // legacy `{orgId: 'media'}` — the backend's documented `{partner_org_id: role}`
    if (!orgId) return null;
    return { ...blankLane(orgId), role: v };
  }
  if (!isObj(v)) return null;
  const id = orgId || str(v.orgId);
  if (!id) return null;
  const status = str(v.status);
  return {
    ...blankLane(id),
    role: str(v.role),
    delivClass: str(v.delivClass),
    deliverables: str(v.deliverables),
    deadline: str(v.deadline),
    contact: str(v.contact),
    materials: str(v.materials),
    ownership: str(v.ownership),
    channels: str(v.channels),
    approval: str(v.approval),
    budget: str(v.budget),
    dependsOn: str(v.dependsOn),
    status: (LANE_STATUSES as readonly string[]).includes(status)
      ? (status as PartnerLane['status'])
      : 'on-track',
  };
}

/** `partner_roles` — a dict keyed by partner-org id whose value is the full
 * lane (:13820-13846), or the legacy role string. The old panel's own array
 * form (`partnerRoles: [{orgId,…}]`, :13354) is tolerated too. */
export function asLanes(u: unknown): PartnerLane[] {
  const out: PartnerLane[] = [];
  if (Array.isArray(u)) {
    for (const v of u) {
      const lane = laneFrom('', v);
      if (lane) out.push(lane);
    }
    return out;
  }
  if (!isObj(u)) return out;
  for (const [orgId, v] of Object.entries(u)) {
    const lane = laneFrom(orgId, v);
    if (lane) out.push(lane);
  }
  return out;
}

/** The wire dict for `partner_roles` — one lane per org; lanes without an
 * org are dropped (nothing to key them on), a later duplicate wins. Every
 * save that touches lanes also sends `partner_org_ids: lanes.map(l => l.orgId)`. */
export function lanesToRoles(lanes: PartnerLane[]): Record<string, PartnerLane> {
  const out: Record<string, PartnerLane> = {};
  for (const lane of lanes) if (lane.orgId) out[lane.orgId] = { ...lane, orgId: lane.orgId };
  return out;
}

/** `links` / `media_links` (:13886). */
export function asLinks(u: unknown): LinkRow[] {
  if (!Array.isArray(u)) return [];
  const out: LinkRow[] = [];
  for (const x of u) if (isObj(x)) out.push({ label: str(x.label), url: str(x.url) });
  return out;
}

/** `team` / `suppliers` / stage `deps` & `files` — an array of strings; a
 * lone comma-separated string (the old inputs, :13796) is split. */
export function asStringList(u: unknown): string[] {
  if (typeof u === 'string') return parseList(u);
  if (!Array.isArray(u)) return [];
  return u
    .filter((x) => typeof x === 'string' || typeof x === 'number')
    .map((x) => String(x).trim())
    .filter(Boolean);
}

/** Package `lines` (:13987 `{svcId, count}`; count is never below 1, :13988). */
export function asPackageLines(u: unknown): PackageLine[] {
  if (!Array.isArray(u)) return [];
  const out: PackageLine[] = [];
  for (const x of u) {
    if (!isObj(x)) continue;
    const svcId = str(x.svcId ?? x.service_id ?? x.id);
    if (!svcId) continue;
    out.push({ svcId, count: projN(x.count) || 1 });
  }
  return out;
}

/** Package `counts` (:13954). */
export function asCounts(u: unknown): PackageCounts {
  const c = isObj(u) ? u : {};
  return {
    posts: projN(c.posts),
    stories: projN(c.stories),
    articles: projN(c.articles),
    interviews: projN(c.interviews),
    photos: projN(c.photos),
    videos: projN(c.videos),
    videoMin: projN(c.videoMin),
  };
}

/** Package `addons` (:13990 — `cur` was the old key). */
export function asAddons(u: unknown): PackageAddon[] {
  if (!Array.isArray(u)) return [];
  const out: PackageAddon[] = [];
  for (const x of u)
    if (isObj(x))
      out.push({
        name: str(x.name),
        price: projN(x.price),
        currency: str(x.currency ?? x.cur),
      });
  return out;
}

/** Package `payment_stages` (:13993). */
export function asPackagePaymentStages(u: unknown): PackagePaymentStage[] {
  if (!Array.isArray(u)) return [];
  const out: PackagePaymentStage[] = [];
  for (const x of u) if (isObj(x)) out.push({ label: str(x.label), pct: projN(x.pct) });
  return out;
}

/** Package `internal` (:13954) — owner / finance only. */
export function asInternal(u: unknown): PackageInternal {
  const it = isObj(u) ? u : {};
  return {
    internalCost: projN(it.internalCost),
    externalCost: projN(it.externalCost),
    minFee: projN(it.minFee),
    recFee: projN(it.recFee),
    targetMargin: projN(it.targetMargin),
  };
}

/** Checklist-template `items` are plain strings (:13712 maps each to a
 * stage checklist row); a `{text}` object is read for its text. */
export function asChecklistStrings(u: unknown): string[] {
  if (!Array.isArray(u)) return [];
  const out: string[] = [];
  for (const x of u) {
    const t = isObj(x) ? str(x.text).trim() : typeof x === 'string' ? x.trim() : '';
    if (t) out.push(t);
  }
  return out;
}

/* ── stage machinery (the ordered `projects.stage` choices replace PROJ_STAGES) */

/** Index in the pipeline, −1 when unknown. (The old `projStageMeta`, :13290,
 * fell back to stage 0 — the port says "not found" instead of "Lead".) */
export function stageIndex(stages: Choice[], key: string | null | undefined): number {
  if (!key) return -1;
  return stages.findIndex((s) => s.value === key);
}

/** The stage's label, falling back to the key. */
export function stageLabel(stages: Choice[], key: string | null | undefined): string {
  return choiceLabel(stages, key);
}

/** :13291 — done / active / wait relative to the current stage. */
export function stageState(
  stages: Choice[],
  current: string | null | undefined,
  key: string,
): 'done' | 'active' | 'wait' {
  const ci = stageIndex(stages, current);
  const ki = stageIndex(stages, key);
  if (ki < ci) return 'done';
  if (ki === ci) return 'active';
  return 'wait';
}

export type ScopeGate = { ok: true } | { ok: false; reason: string };

/**
 * :13320 `projScopeGate` — a curatorial/mixed project cannot enter Research
 * or Production before Scope Approval, Contract and Deposit. The old rule
 * read `stages[k].doneTs`; the port keys on ORDER, which is what a forward
 * move through the pipeline means. The two agree for every project moved
 * since `stages` became writable (`moveStages` stamps `doneTs` on every
 * earlier stage, :13711), and the order rule also covers a project moved
 * before that, whose sub-state carries no stamps:
 * allowed once the CURRENT stage's index ≥ index('deposit'); "still needed"
 * = the gate stages beyond the current index.
 */
export function scopeGate(
  p: Partial<Pick<ProjectAdmin, 'category' | 'stage'>>,
  target: string,
  stages: Choice[],
): ScopeGate {
  const cat = p.category || '';
  const isCur = cat === 'curatorial' || cat === 'mixed';
  if (isCur && (target === 'research' || target === 'production')) {
    const ci = stageIndex(stages, p.stage);
    const di = stageIndex(stages, 'deposit');
    if (di >= 0 && ci < di) {
      const missing = GATE_STAGES.filter((k) => stageIndex(stages, k) > ci).map((k) =>
        stageLabel(stages, k),
      );
      if (missing.length)
        return {
          ok: false,
          reason:
            'Curatorial work can’t begin until Scope Approval, Contract and Deposit are all recorded. Still needed: ' +
            missing.join(', ') +
            '.',
        };
    }
  }
  return { ok: true };
}

/* ── stage move seeding (:13706-13714) ──────────────────────────────────── */

/** :13707 — the blank sub-state the old move created for a stage it touched.
 * `intApproved`/`cliApproved` are the old literal `false` (see `moveStages`). */
export function blankStageState(): Record<string, unknown> {
  return {
    owner: '',
    start: '',
    due: '',
    deps: [],
    files: [],
    checklist: [],
    intApproved: false,
    cliApproved: false,
    notes: '',
    doneTs: 0,
  };
}

/** :13321 `projChecklistFor` — the first template for the stage, as its
 * items (null when there is none). */
export function checklistFor(
  templates: ReadonlyArray<{ stage?: string | null; items?: unknown }>,
  stageKey: string,
): string[] | null {
  const t = templates.find((x) => (x.stage ?? '') === stageKey);
  return t ? asChecklistStrings(t.items) : null;
}

/**
 * :13706-13714 — the `stages` JSON a move to `target` writes, from the
 * record's current one (`raw`, untouched): the target entry is created blank
 * if missing, dated `today` if it has no start, and given the template's
 * checklist if it has none; every stage BEFORE the target (in the
 * `projects.stage` order) is created blank if missing and stamped
 * `doneTs = now` if it has no stamp yet. Keys the page does not know are
 * kept as they were. The status half of the old move (`projStatusForStage`)
 * is the server's (`POST …/stage/`), so it is not written here.
 *
 * Note (flagged, C-24): the old blank carried `intApproved: false` and
 * `cliApproved: false`, and they are kept verbatim. The old desk only asked
 * those flags of a project sitting IN a review stage (:13314); the backend's
 * `_awaits_approval` asks them of every entry, so a moved project counts as
 * awaiting approval until someone records the approvals.
 */
export function moveStages(
  raw: unknown,
  order: Choice[],
  target: string,
  template: string[] | null,
  today: string,
  now: number = Date.now(),
): Record<string, unknown> {
  const src = isObj(raw) ? raw : {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) out[k] = isObj(v) ? { ...v } : v;
  const entry = (k: string): Record<string, unknown> => {
    const cur = out[k];
    if (isObj(cur)) return cur;
    const fresh = blankStageState();
    out[k] = fresh;
    return fresh;
  };
  const s = entry(target);
  if (!str(s.start)) s.start = today;
  if (!Array.isArray(s.checklist) || s.checklist.length === 0) {
    if (template)
      s.checklist = template.map((text) => ({
        id: uid('ci', now),
        text,
        owner: '',
        due: '',
        done: false,
      }));
  }
  const idx = stageIndex(order, target);
  order.forEach((ps, i) => {
    if (i >= idx) return;
    const e = entry(ps.value);
    if (!projN(e.doneTs)) e.doneTs = now;
  });
  return out;
}

/* ── flags — mirror the backend (`services.py:208-232`) ─────────────────── */

/** The slice of a project the flags read — a `ProjectAdmin` fits as is. */
export type ProjectLike = Partial<
  Pick<
    ProjectAdmin,
    | 'id'
    | 'no'
    | 'name'
    | 'category'
    | 'stage'
    | 'status'
    | 'stages'
    | 'archived'
    | 'deliverables'
    | 'money'
    | 'venue'
    | 'start_date'
    | 'end_date'
    | 'partner_roles'
  >
>;

/** `_is_active` (:209): not archived and not in the archive stage. (The old
 * :13315 also excluded Completed/Cancelled statuses; the backend does not.) */
export function isActive(p: ProjectLike): boolean {
  return !p.archived && p.stage !== 'archive';
}

/** `_is_delayed` (:212): any stage entry with `due < today` and no `doneTs`
 * (ISO dates compare as strings, exactly like the backend). */
export function isDelayed(p: ProjectLike, today: string): boolean {
  for (const s of Object.values(asStages(p.stages)))
    if (s.due && !s.doneTs && s.due < today) return true;
  return false;
}

/** `_awaits_approval` (:222): any stage entry whose `intApproved` or
 * `cliApproved` is literally `false`. */
export function awaitsApproval(p: ProjectLike): boolean {
  return Object.values(asStages(p.stages)).some(
    (s) => s.intApproved === false || s.cliApproved === false,
  );
}

/** `_unpaid_count` (:229): payments not marked paid. */
export function unpaidCount(p: ProjectLike): number {
  return asMoney(p.money, '').payments.filter((x) => !x.paid).length;
}

/** :13318 / `dashboard_summary` (:243): open deliverables due within 7 days
 * (overdue ones included, as both sides count them). */
export function nextDeliverables(p: ProjectLike, today: string): Deliverable[] {
  const todayMs = Date.parse(today);
  const out: Deliverable[] = [];
  if (!Number.isFinite(todayMs)) return out;
  for (const d of asDeliverables(p.deliverables)) {
    if (d.done || !d.due) continue;
    const due = Date.parse(d.due);
    if (Number.isFinite(due) && due - todayMs <= 7 * DAY_MS) out.push(d);
  }
  return out;
}

/** :13319 — "text · due" of the soonest open deliverable (an undated one only
 * when nothing dated exists), '—' when there is none. */
export function nextDelText(p: ProjectLike): string {
  let nx: Deliverable | null = null;
  let best = Infinity;
  for (const d of asDeliverables(p.deliverables)) {
    if (d.done) continue;
    const due = d.due ? Date.parse(d.due) : 0;
    if (due && due < best) {
      best = due;
      nx = d;
    } else if (!due && !nx) nx = d;
  }
  return nx ? (nx.text || 'Deliverable') + (nx.due ? ' · ' + nx.due : '') : '—';
}

/** :13308 — the current stage's due date ('' when none). */
export function stageDue(p: ProjectLike): string {
  return asStages(p.stages)[p.stage ?? '']?.due ?? '';
}

export interface ProjFlag {
  c: 'wait' | 'done' | 'block' | 'attn' | 'active';
  t: string;
}

/** :13309 — the status chip: Archived / Completed / Overdue / Due soon / the
 * stage label. `today` replaces the old `Date.now()` so the rule is pure. */
export function projFlag(p: ProjectLike, stages: Choice[], today: string): ProjFlag {
  if (p.archived) return { c: 'wait', t: 'Archived' };
  if (p.stage === 'archive' || p.status === 'Completed')
    return { c: 'done', t: p.status === 'Completed' ? 'Completed' : 'Archived' };
  const due = stageDue(p);
  if (due) {
    const diff = Date.parse(due) - Date.parse(today);
    if (Number.isFinite(diff)) {
      if (diff < 0) return { c: 'block', t: 'Overdue' };
      if (diff < 3 * DAY_MS) return { c: 'attn', t: 'Due soon' };
    }
  }
  return { c: 'active', t: stageLabel(stages, p.stage) };
}

export interface MoneyByCur {
  cur: string;
  internal: number;
  external: number;
  fee: number;
  client: number;
  paid: number;
  due: number;
}

/** :13301 `projMoneyCalc` — per-currency totals, NEVER converted. Amounts
 * without a currency group under `defaultCurrency` (old `projDefCur()`). */
export function moneyCalc(
  p: ProjectLike,
  defaultCurrency = '',
): { byCur: Record<string, MoneyByCur>; currencies: string[] } {
  const m = asMoney(p.money, defaultCurrency);
  const byCur: Record<string, MoneyByCur> = {};
  const currencies: string[] = [];
  const bucket = (cur: string): MoneyByCur => {
    const key = cur || defaultCurrency;
    if (!byCur[key]) {
      byCur[key] = { cur: key, internal: 0, external: 0, fee: 0, client: 0, paid: 0, due: 0 };
      currencies.push(key);
    }
    return byCur[key];
  };
  const pairs: Array<[MoneyAmount, 'internal' | 'external' | 'fee' | 'client']> = [
    [m.internalCost, 'internal'],
    [m.externalCost, 'external'],
    [m.fee, 'fee'],
    [m.clientPrice, 'client'],
  ];
  for (const [o, k] of pairs) {
    const v = projN(o.amount);
    if (v) bucket(o.currency)[k] += v;
  }
  for (const pay of m.payments) {
    const v = projN(pay.amount);
    if (!v) continue;
    const b = bucket(pay.currency);
    if (pay.paid) b.paid += v;
    else b.due += v;
  }
  return { byCur, currencies };
}

/** :13631-13635 — the list's quick filter; anything but a known quick means
 * "no quick filter" (the old `'all'`). */
export function matchesQuick(p: ProjectLike, quick: string | null | undefined, today: string) {
  switch (quick) {
    case 'active':
      return isActive(p);
    case 'delayed':
      return isActive(p) && isDelayed(p, today);
    case 'approval':
      return isActive(p) && awaitsApproval(p);
    case 'deliverables':
      return isActive(p) && nextDeliverables(p, today).length > 0;
    case 'unpaid':
      return isActive(p) && unpaidCount(p) > 0;
    default:
      return true;
  }
}

/* ── packages & pricing (:13334-13336, :13954, :14002-14013) ────────────── */

type CatalogRow = Pick<ServiceCatalogItemAdmin, 'id' | 'name' | 'category' | 'price'> &
  Partial<Pick<ServiceCatalogItemAdmin, 'internal_cost' | 'unit' | 'currency'>>;

function svcFind(catalog: CatalogRow[], svcId: string): CatalogRow | undefined {
  return catalog.find((s) => s.id === svcId);
}

/** :13334 — the service's name, or the old placeholder once it is gone. */
export function svcName(catalog: CatalogRow[], svcId: string): string {
  return svcFind(catalog, svcId)?.name ?? '(removed service)';
}

/** Σ price × count over the lines whose service still exists (:14058). */
export function packageLineTotal(
  pkg: Pick<PackageTemplateAdmin, 'lines'>,
  catalog: CatalogRow[],
): number {
  let total = 0;
  for (const l of asPackageLines(pkg.lines)) {
    const s = svcFind(catalog, l.svcId);
    if (s) total += projN(s.price) * l.count;
  }
  return total;
}

export interface ScopeCat {
  cat: string;
  label: string;
  included: boolean;
  items: Array<{ name: string; count: number; price: number }>;
}

/** :13336 `projScopeByCat` (§9) — every category is INCLUDED (with its
 * lines) or explicitly available as an addition; nothing bundled invisibly.
 * `categories` = the `projects.service_category` choices. */
export function scopeByCat(
  lines: PackageLine[],
  catalog: CatalogRow[],
  categories: Choice[],
): ScopeCat[] {
  const byCat: Record<string, ScopeCat['items']> = {};
  for (const l of lines) {
    const s = svcFind(catalog, l.svcId);
    if (!s) continue;
    (byCat[s.category ?? ''] ??= []).push({
      name: s.name,
      count: l.count || 1,
      price: projN(s.price),
    });
  }
  return categories.map((c) => ({
    cat: c.value,
    label: c.label,
    included: !!byCat[c.value],
    items: byCat[c.value] ?? [],
  }));
}

/** :13954 `_blankPkg` — the new-package defaults, verbatim. */
export function blankPackage(): PackageTemplateInput {
  return {
    name: '',
    purpose: '',
    lines: [] as PackageLine[],
    counts: {
      posts: 0,
      stories: 0,
      articles: 0,
      interviews: 0,
      photos: 0,
      videos: 0,
      videoMin: 0,
    } satisfies PackageCounts,
    onsite: false,
    team: [] as string[],
    suppliers: [] as string[],
    client_resp: '',
    materials: '',
    prod_timeline: '',
    pub_timeline: '',
    revisions: 1,
    approval: 'One internal + one client review.',
    usage_rights: 'Darz channels; client re-use with credit.',
    archive_duration: '12 months',
    addons: [] as PackageAddon[],
    internal: {
      internalCost: 0,
      externalCost: 0,
      minFee: 0,
      recFee: 0,
      targetMargin: 40,
    } satisfies PackageInternal,
    deposit_pct: 50,
    payment_stages: [
      { label: 'Deposit', pct: 50 },
      { label: 'On delivery', pct: 50 },
    ] satisfies PackagePaymentStage[],
    cancellation: 'Deposit non-refundable once work has begun.',
  };
}

/** :14006 / :13909 — "3× Photo coverage" (count only when above one). */
function lineText(catalog: CatalogRow[], l: PackageLine): string {
  return (l.count > 1 ? l.count + '× ' : '') + svcName(catalog, l.svcId);
}

/**
 * :14002-14013 `_doApplyPackage` — the patch that applies a package to a
 * project: `applied_package`, the package's lines appended as deliverables
 * (skipping ones already there, case-insensitively), and money from the
 * package's internal pricing (fee = clientPrice = recFee) with the payment
 * schedule from its stages × recFee. Existing amounts are overwritten, the
 * invoice status is kept (defaulting to 'none'). The old snapshot copy
 * (`appliedPackage`, :14004) has no API field — the FK is the link.
 */
export function applyPackage(
  p: Pick<ProjectAdmin, 'deliverables' | 'money'>,
  pkg: Pick<PackageTemplateAdmin, 'id' | 'lines' | 'internal' | 'payment_stages'>,
  catalog: CatalogRow[],
  currency: string,
  now: number,
): Pick<ProjectPatch, 'applied_package' | 'deliverables' | 'money'> {
  const deliverables = asDeliverables(p.deliverables);
  const have = new Set(deliverables.map((x) => x.text.toLowerCase()));
  for (const l of asPackageLines(pkg.lines)) {
    const t = lineText(catalog, l);
    const key = t.toLowerCase();
    if (have.has(key)) continue;
    deliverables.push({
      id: uid('dl', now),
      text: t,
      owner: '',
      due: '',
      depId: '',
      done: false,
      doneTs: 0,
      doneBy: '',
    });
    have.add(key);
  }
  const it = asInternal(pkg.internal);
  const amt = (n: number): MoneyAmount => ({ amount: n ? String(n) : '', currency });
  const price = it.recFee;
  const money: ProjectMoney = {
    ...asMoney(p.money, currency),
    internalCost: amt(it.internalCost),
    externalCost: amt(it.externalCost),
    fee: amt(price),
    clientPrice: amt(price),
    payments: asPackagePaymentStages(pkg.payment_stages).map((st) => ({
      id: uid('pay', now),
      label: st.label,
      amount: price ? String(Math.round((price * st.pct) / 100)) : '',
      currency,
      due: '',
      paid: false,
      paidTs: 0,
    })),
  };
  return { applied_package: pkg.id, deliverables, money };
}

/* ── calculator (D21 — priced from the catalogue, never from constants) ─── */

export interface CalcInput {
  discountPct?: unknown;
  /** overrides the recommended price when non-empty (:13372) */
  approvedPrice?: unknown;
  depositPct?: unknown;
}

export interface Quote {
  /** Σ internal_cost × count */
  internal: number;
  /** Σ price × count — the recommended price */
  price: number;
  discountPct: number;
  approved: number;
  gross: number;
  margin: number;
  depositPct: number;
  deposit: number;
  remaining: number;
}

/** The pricing maths of :13358-13378 on catalogue lines: `approved` is the
 * typed price if any, else price × (1 − discount%); gross = approved −
 * internal; margin = gross / approved. */
export function calcQuote(lines: PackageLine[], catalog: CatalogRow[], inp: CalcInput): Quote {
  let internal = 0;
  let price = 0;
  for (const l of lines) {
    const s = svcFind(catalog, l.svcId);
    if (!s) continue;
    const count = l.count || 1;
    internal += projN(s.internal_cost) * count;
    price += projN(s.price) * count;
  }
  const discountPct = projN(inp.discountPct);
  const typed = inp.approvedPrice != null && str(inp.approvedPrice).trim() !== '';
  const approved = typed ? projN(inp.approvedPrice) : price * (1 - discountPct / 100);
  const gross = approved - internal;
  const margin = approved > 0 ? (gross / approved) * 100 : 0;
  const depositPct = projN(inp.depositPct);
  const deposit = (approved * depositPct) / 100;
  return {
    internal,
    price,
    discountPct,
    approved,
    gross,
    margin,
    depositPct,
    deposit,
    remaining: approved - deposit,
  };
}

/** :15358 `calcSaveToProject` — the quote as a project's money blob:
 * internalCost = internal, externalCost = 0 (the catalogue does not split
 * it), fee = gross, clientPrice = approved, Deposit / On delivery stages. */
export function quoteToMoney(quote: Quote, currency: string, now: number): ProjectMoney {
  const amt = (n: number): MoneyAmount => {
    const r = Math.round(n);
    return { amount: r ? String(r) : '', currency };
  };
  const pay = (label: string, n: number): PaymentStage => ({
    id: uid('pay', now),
    label,
    ...amt(n),
    due: '',
    paid: false,
    paidTs: 0,
  });
  return {
    internalCost: amt(quote.internal),
    externalCost: amt(0),
    fee: amt(quote.gross),
    clientPrice: amt(quote.approved),
    payments: [pay('Deposit', quote.deposit), pay('On delivery', quote.remaining)],
    invoiceStatus: 'none',
  };
}

/* ── proposal (the PDF's field blob, `buildDocumentFields` shape) ───────── */

export interface ProposalOpts {
  reference: string;
  note?: string;
  terms?: string;
  currency: string;
  clientName: string;
  /** ISO date; defaults to today (the one impure input, kept injectable) */
  issuedAt?: string;
}

/**
 * The self-contained blob a proposal PDF renders from — a SNAPSHOT of the
 * package at issue time, in the exact `DocumentPdfFields` shape the shared
 * `documentPdf` renderer reads. Lines are priced from the catalogue as
 * price × count (:14058, which also skipped lines whose service is gone);
 * the old composer's `recFee` override of the total (:14057) is not ported,
 * so the total always equals the lines shown.
 */
export function buildProposalFields(
  p: Partial<Pick<ProjectAdmin, 'no' | 'name' | 'venue' | 'start_date' | 'end_date'>>,
  pkg: Pick<PackageTemplateAdmin, 'lines'>,
  catalog: CatalogRow[],
  opts: ProposalOpts,
): DocumentPdfFields {
  const lines: NonNullable<DocumentPdfFields['lines']> = [];
  let subtotal = 0;
  for (const l of asPackageLines(pkg.lines)) {
    const s = svcFind(catalog, l.svcId);
    if (!s) continue;
    const total = Math.round(projN(s.price) * l.count * 100) / 100;
    subtotal += total;
    lines.push({
      title: lineText(catalog, l),
      description: '',
      price: fmtThousands(String(total)),
      currency: opts.currency,
    });
  }
  const dates = [p.start_date, p.end_date].filter(Boolean).join('–');
  return {
    reference: opts.reference,
    doc_label: PROPOSAL_SERIES.label,
    // the shared renderer's show wording, re-headed for a project
    lines_label: 'Proposed for this project',
    counterparty_label: 'From the client',
    issued_at: opts.issuedAt || todayIso(),
    show: {
      title: p.name ?? '',
      gallery: opts.clientName,
      artists: '',
      dates,
      venue: p.venue ?? '',
      project: p.no ?? '',
    },
    lines,
    currency: opts.currency,
    subtotal,
    discount: 0,
    total: subtotal,
    note: opts.note || '',
    terms: opts.terms || '',
  };
}

/* ---- reading a paginated list whole -------------------------------------
   Some desks here still need a whole list the API only pages: the old panel
   read its one local store (`projLoad()`, `svcLoad()`) and filtered in memory.
   The quick cards are server filters now (G-PROJ-1, `serverQuick`), but the
   board, the "Deliverables ≤7d" card and the Partners matrices read every
   project. One walker, one cap, so the desks cannot differ on how much of a
   list they actually read. */

/* `WALK_MAX_PAGES` / `walkPages` now live in `src/api/paging.ts` (every desk that
   reads a list whole shares them); re-exported so the desks here keep importing
   from this file. */
export { WALK_MAX_PAGES, walkPages } from '../../../api/paging';

/** Every project of one archive state (the board, the deliverables card,
 * the Partners desk, the project picks). */
export function walkProjects(
  api: ProjectsAdminService,
  archived = false,
): Promise<ProjectAdmin[]> {
  return walkPages((page) => api.projects({ archived, per_page: 100, page }));
}

/** The whole service catalogue (`svcLoad()`, :13920) — the packages, the
 * calculator and every proposal price from it. */
export function walkServices(api: ProjectsAdminService): Promise<ServiceCatalogItemAdmin[]> {
  return walkPages((page) => api.services({ per_page: 100, page }));
}

/** `projClientName` (:13298) — the linked org's name, else the typed
 * fallback, else ''. The one rule every desk names a client by. */
export function clientName(p: ProjectAdmin): string {
  return p.client_partner_org?.name || p.client_name || '';
}

/* ── money totals (G-PROJ-9) — decimal STRINGS, never float maths (C-22) ── */

const DEC = /^(-?)(\d+)(?:\.(\d+))?$/;

/** Exact sum of two decimal strings (BigInt on the scaled digits). An operand
 * that is not a plain decimal counts as 0 — the backend's own `_money_num`
 * rule for an unparsable amount. */
export function decAdd(a: string, b: string): string {
  const pa = DEC.exec(String(a ?? '').trim());
  const pb = DEC.exec(String(b ?? '').trim());
  const fa = pa?.[3] ?? '';
  const fb = pb?.[3] ?? '';
  const scale = Math.max(fa.length, fb.length);
  const big = (m: RegExpExecArray | null, frac: string): bigint => {
    if (!m) return 0n;
    const digits = BigInt(m[2] + frac.padEnd(scale, '0'));
    return m[1] === '-' ? -digits : digits;
  };
  const sum = big(pa, fa) + big(pb, fb);
  const neg = sum < 0n;
  const abs = (neg ? -sum : sum).toString().padStart(scale + 1, '0');
  const int = abs.slice(0, abs.length - scale) || '0';
  const frac = scale ? '.' + abs.slice(abs.length - scale) : '';
  return (neg ? '-' : '') + int + frac;
}

/** True for "0", "0.00", "-0.0", "" — read off the string. */
export function decIsZero(v: string | null | undefined): boolean {
  const m = DEC.exec(String(v ?? '').trim());
  return !m || /^0*$/.test(m[2] + (m[3] ?? ''));
}

/**
 * A served decimal as the desk shows money: thousands-grouped, an all-zero
 * fraction dropped ("1200.00" → "1,200", "1200.50" → "1,200.50"), with the
 * currency after it like the old `projMoney` (:13288). No float step at all —
 * the old rounding (`Math.round`) is not applied to a served amount. Anything
 * that is not a plain decimal is shown verbatim.
 */
export function fmtDecimal(v: string | null | undefined, cur?: string): string {
  const s = String(v ?? '').trim();
  const m = DEC.exec(s);
  let out = s;
  if (m) {
    const frac = m[3] && !/^0+$/.test(m[3]) ? '.' + m[3] : '';
    out = m[1] + m[2].replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',') + frac;
    if (out === '-0') out = '0';
  }
  return out + (cur ? ' ' + cur : '');
}

/** The 8-dp rate as typed: trailing zeros of the fraction dropped
 * ("700000.00000000" → "700,000", "0.00125000" → "0.00125"). */
export function fmtRate(v: string | null | undefined): string {
  const s = String(v ?? '').trim();
  const m = DEC.exec(s);
  if (!m) return s;
  const frac = (m[3] ?? '').replace(/0+$/, '');
  return fmtDecimal(m[1] + m[2] + (frac ? '.' + frac : ''));
}

/** The bucket key the backend uses for a currency-less line with no deal
 * currency (`_money_currency`, services.py:322-326). */
export const UNKNOWN_CURRENCY = 'unknown';

/** How a bucket key reads on screen: "unknown" is not a currency code. */
export function currencyLabel(cur: string): string {
  return cur === UNKNOWN_CURRENCY ? 'No currency' : cur;
}

export interface TotalsRow {
  cur: string;
  label: string;
  client: string;
  fee: string;
  /** internal + external, exact — the old row's "Cost" (:13800) */
  cost: string;
  paid: string;
  due: string;
  /** the old row showed Paid / Due only when either was non-zero (:13800) */
  showPaid: boolean;
}

/** One `.dzp-mrow` per bucket, in the old row's shape (:13800). */
export function totalsRow(
  cur: string,
  b: Partial<ProjectMoneyBucket> | null | undefined,
): TotalsRow {
  const v = (k: keyof ProjectMoneyBucket): string => String(b?.[k] ?? '0');
  return {
    cur,
    label: currencyLabel(cur),
    client: v('client'),
    fee: v('fee'),
    cost: decAdd(v('internal'), v('external')),
    paid: v('paid'),
    due: v('due'),
    showPaid: !decIsZero(v('paid')) || !decIsZero(v('due')),
  };
}

/** Every bucket of a totals response — the `"unknown"` bucket last, the
 * rest in the order served. A malformed `by_currency` reads as none. */
export function totalsRows(
  t: Pick<ProjectTotals, 'by_currency'> | null | undefined,
): TotalsRow[] {
  const raw: unknown = t?.by_currency;
  const by: Record<string, unknown> = isObj(raw) ? raw : {};
  const keys = Object.keys(by).sort(
    (a, b) => Number(a === UNKNOWN_CURRENCY) - Number(b === UNKNOWN_CURRENCY),
  );
  return keys.map((k) =>
    totalsRow(k, isObj(by[k]) ? (by[k] as Partial<ProjectMoneyBucket>) : null),
  );
}

/* ── manual FX (G-PROJ-9) ────────────────────────────────────────────────── */

/** The FX inputs as typed. */
export interface FxDraft {
  deal_currency: string;
  deal_fx_target_currency: string;
  deal_fx_rate: string;
  deal_fx_rate_date: string;
}

export function fxDraftFrom(
  p: Partial<
    Pick<
      ProjectAdmin,
      'deal_currency' | 'deal_fx_target_currency' | 'deal_fx_rate' | 'deal_fx_rate_date'
    >
  >,
): FxDraft {
  return {
    deal_currency: p.deal_currency ?? '',
    deal_fx_target_currency: p.deal_fx_target_currency ?? '',
    deal_fx_rate: p.deal_fx_rate ?? '',
    deal_fx_rate_date: p.deal_fx_rate_date ?? '',
  };
}

/**
 * The four FX fields on the wire: blank rate / date → null (the model's
 * nullable columns), the rate's thousands separators stripped ("700,000" →
 * "700000") so a grouped entry is not a 400, the target upper-cased (the
 * backend takes any 3 characters, C-22). A rate that is still not a decimal
 * goes as typed — the server's 400 names the field.
 */
export function fxPatch(
  d: FxDraft,
): Pick<
  ProjectPatch,
  'deal_currency' | 'deal_fx_target_currency' | 'deal_fx_rate' | 'deal_fx_rate_date'
> {
  const rate = d.deal_fx_rate.replace(/[,\s ٬]/g, '');
  return {
    deal_currency: d.deal_currency.trim() as NonNullable<ProjectPatch['deal_currency']>,
    deal_fx_target_currency: d.deal_fx_target_currency.trim().toUpperCase(),
    deal_fx_rate: rate ? rate : null,
    deal_fx_rate_date: d.deal_fx_rate_date.trim() || null,
  };
}
