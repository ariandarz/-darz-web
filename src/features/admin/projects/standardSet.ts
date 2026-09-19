/**
 * standardSet — "the standard set": the old admin panel's own opening rates,
 * as data plus the pure helpers that turn them into API bodies.
 *
 * WHERE IT COMES FROM. The old panel seeded its client-local store the first
 * time a Projects view opened (`projSeedIfEmpty`, `darz-studio.html`
 * :13381-13451): 34 service-catalogue lines (:13386-13420), 8 package
 * templates (the shared `pkg()` defaults at :13424, the templates at
 * :13426-13433), a rate card (:13437-13442) and 4 checklist templates
 * (:13444-13447). Every value below is copied from those lines exactly —
 * names, units, internal costs, prices, purposes, counts, internal pricing,
 * payment stages and checklist items, including the "&" and "/" in names and
 * the typographic apostrophe in PKG2's "Darz’s".
 *
 * WHY IT IS DATA HERE AND NOT A SEED. Phase 11c deliberately did not port the
 * silent seeding — a server DB starts honest and empty, and a store that
 * fills itself on first open cannot be told apart from real work. D21 (the
 * owner's decision) is that the old rates SHOULD be in the real catalogue, so
 * the port is an explicit, idempotent, owner-only action on the Packages
 * desk ("Add the standard set") that writes these rows through the normal
 * admin API. Nothing in this module runs on its own: an owner clicks it, and
 * a run is resumable because every plan skips what is already there by name.
 *
 * THE CATEGORY MAPPING (G-PROJ-4). The old catalogue had seven categories
 * (`SVC_CATS`, :13327); the backend serves four (`projects.service_category`
 * — media / production / curatorial / other). Each line therefore carries
 * BOTH its old category (`oldCategory`, so nothing is lost) and the served
 * one it is filed under (`category`, `OLD_CATEGORY_MAP` below):
 *
 *   media → media · content → production · editorial → media ·
 *   curatorial → curatorial · pm → other · documentation → production ·
 *   distribution → splits by line: "Darz channel distribution" is a Darz
 *   channel (media), "English-language translation" is neither media nor
 *   production work (other).
 *
 * WHAT DOES NOT PORT. The rate card itself (:13437-13442 — the six hourly
 * rates, contingency 10%, min margin 20%, target margin 40% and the ten
 * multipliers, all at 1.0) has no backend field to live in, and under D21 the
 * catalogue's own prices and internal costs ARE the rates: the calculator
 * prices from the catalogue (`calcQuote`, `projectForm.ts`), not from hours ×
 * a rate. The desk says so once, on the card that offers this action. Its
 * currency (`cur:'USD'`, :13441) is the one part that survives, as
 * `STANDARD_CURRENCY` — the currency every seeded line is priced in.
 *
 * Everything here is pure: no React, no API calls, no clock, no `id`s. The
 * old `SVC01…`/`PKG1…`/`CHK1…` ids were local-store keys and are NOT carried
 * over — a package names its service LINES, and the runner resolves those
 * names to the real ids the API hands back (`serviceIdIndex`).
 */
import type {
  ChecklistTemplateInput,
  PackageTemplateInput,
  ProjectStage,
  ServiceCatalogItemInput,
  ServiceCategory,
} from '../../../api/types';
import {
  asCounts,
  blankPackage,
  type PackageCounts,
  type PackageInternal,
  type PackageLine,
  type PackagePaymentStage,
  type UNITS,
} from './projectForm';

/** The unit vocabulary of the service editor (`UNITS`, :13935). */
type ServiceUnit = (typeof UNITS)[number];

/* ── service catalogue (:13386-13420) ───────────────────────────────────── */

export interface StandardService {
  /** Verbatim from the old row — also the idempotency key. */
  name: string;
  /** The old panel's own category (`SVC_CATS`, :13327) — kept so the
   * narrowing to four is recorded, never silently lost (G-PROJ-4). */
  oldCategory: string;
  /** The served category the line is filed under. */
  category: ServiceCategory;
  unit: ServiceUnit;
  internalCost: number;
  price: number;
}

/** The old seven → the served four (G-PROJ-4). `distribution` is `null`
 * because it splits by line (see the two lines' own `category`). */
export const OLD_CATEGORY_MAP: Readonly<Record<string, ServiceCategory | null>> = {
  media: 'media',
  content: 'production',
  editorial: 'media',
  curatorial: 'curatorial',
  pm: 'other',
  documentation: 'production',
  distribution: null,
};

/** :13386-13420, in the old file's order. */
export const STANDARD_SERVICES: readonly StandardService[] = [
  {
    name: 'Exhibition listing',
    oldCategory: 'media',
    category: 'media',
    unit: 'piece',
    internalCost: 20,
    price: 120,
  },
  {
    name: 'Social media post',
    oldCategory: 'media',
    category: 'media',
    unit: 'piece',
    internalCost: 40,
    price: 180,
  },
  {
    name: 'Instagram story series',
    oldCategory: 'media',
    category: 'media',
    unit: 'piece',
    internalCost: 35,
    price: 150,
  },
  {
    name: 'Content photography (half day)',
    oldCategory: 'content',
    category: 'production',
    unit: 'day',
    internalCost: 180,
    price: 600,
  },
  {
    name: 'Short-form video production',
    oldCategory: 'content',
    category: 'production',
    unit: 'piece',
    internalCost: 300,
    price: 900,
  },
  {
    name: 'Reel / video edit',
    oldCategory: 'content',
    category: 'production',
    unit: 'piece',
    internalCost: 120,
    price: 400,
  },
  {
    name: 'Editorial article',
    oldCategory: 'editorial',
    category: 'media',
    unit: 'piece',
    internalCost: 150,
    price: 500,
  },
  {
    name: 'Artist interview (written)',
    oldCategory: 'editorial',
    category: 'media',
    unit: 'piece',
    internalCost: 180,
    price: 650,
  },
  {
    name: 'Exhibition review',
    oldCategory: 'editorial',
    category: 'media',
    unit: 'piece',
    internalCost: 140,
    price: 480,
  },
  {
    name: 'Curatorial research',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'hour',
    internalCost: 40,
    price: 120,
  },
  {
    name: 'Exhibition concept development',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'piece',
    internalCost: 600,
    price: 1800,
  },
  {
    name: 'Exhibition text & wall texts',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'piece',
    internalCost: 250,
    price: 800,
  },
  {
    name: 'Artist & artwork selection',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'day',
    internalCost: 350,
    price: 1000,
  },
  {
    name: 'Project management',
    oldCategory: 'pm',
    category: 'other',
    unit: 'day',
    internalCost: 200,
    price: 500,
  },
  {
    name: 'Coordination & scheduling',
    oldCategory: 'pm',
    category: 'other',
    unit: 'hour',
    internalCost: 25,
    price: 70,
  },
  {
    name: 'Professional artwork documentation',
    oldCategory: 'documentation',
    category: 'production',
    unit: 'day',
    internalCost: 220,
    price: 700,
  },
  {
    name: 'Installation photography',
    oldCategory: 'documentation',
    category: 'production',
    unit: 'piece',
    internalCost: 80,
    price: 280,
  },
  {
    name: 'Archive creation & handoff',
    oldCategory: 'documentation',
    category: 'production',
    unit: 'piece',
    internalCost: 150,
    price: 450,
  },
  {
    // :13404 — a Darz channel, so it files under media
    name: 'Darz channel distribution',
    oldCategory: 'distribution',
    category: 'media',
    unit: 'piece',
    internalCost: 30,
    price: 150,
  },
  {
    // :13405 — neither media nor production work, so it files under other
    name: 'English-language translation',
    oldCategory: 'distribution',
    category: 'other',
    unit: 'piece',
    internalCost: 90,
    price: 300,
  },
  /* :13406 — full curatorial service lines (§9); each priced, never bundled
     invisibly (the old file's own section comment) */
  {
    name: 'Artist research',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'hour',
    internalCost: 40,
    price: 120,
  },
  {
    name: 'Exhibition narrative',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'piece',
    internalCost: 280,
    price: 900,
  },
  {
    name: 'Title development',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'piece',
    internalCost: 120,
    price: 400,
  },
  {
    name: 'Wall texts',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'piece',
    internalCost: 160,
    price: 520,
  },
  {
    name: 'Artwork captions',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'piece',
    internalCost: 90,
    price: 300,
  },
  {
    name: 'Spatial & narrative planning',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'day',
    internalCost: 320,
    price: 950,
  },
  {
    name: 'Public programmes',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'piece',
    internalCost: 250,
    price: 750,
  },
  {
    name: 'Talks & panels',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'piece',
    internalCost: 200,
    price: 650,
  },
  {
    name: 'Artist coordination',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'day',
    internalCost: 180,
    price: 500,
  },
  {
    name: 'Catalogue development',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'piece',
    internalCost: 700,
    price: 2200,
  },
  {
    name: 'Collector communication',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'piece',
    internalCost: 150,
    price: 480,
  },
  {
    name: 'Institutional communication',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'piece',
    internalCost: 180,
    price: 560,
  },
  {
    name: 'Press briefing',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'piece',
    internalCost: 140,
    price: 450,
  },
  {
    name: 'Post-project report',
    oldCategory: 'curatorial',
    category: 'curatorial',
    unit: 'piece',
    internalCost: 180,
    price: 560,
  },
];

/** :13441 `cur:'USD'` — the only part of the old rate card that survives:
 * the currency its prices were quoted in. The desk passes it to
 * `serviceInput` after checking it against the `currency` options. */
export const STANDARD_CURRENCY = 'USD';

/* ── package templates (:13424-13433) ───────────────────────────────────── */

/** One service line of a template, named rather than id'd: the old
 * `{svcId:'SVC07',count:1}` referenced local-store ids that do not exist
 * here, so the runner resolves the NAME against the real catalogue. */
export interface StandardPackageLine {
  /** Matches a `StandardService.name`. */
  service: string;
  count: number;
}

/** The old `extra` argument of `pkg()` (:13424): what a template overrides on
 * top of the shared defaults. Anything absent keeps the default — which is
 * `blankPackage()`, the same :13954 `_blankPkg` block `pkg()`'s base is
 * (counts zeroed, onsite false, revisions 1, "One internal + one client
 * review.", "Darz channels; client re-use with credit.", "12 months",
 * internal all 0 at 40% target margin, deposit 50, Deposit 50 / On delivery
 * 50, "Deposit non-refundable once work has begun."). */
export interface StandardPackageOverrides {
  onsite?: boolean;
  usageRights?: string;
  archiveDuration?: string;
  internal?: PackageInternal;
  depositPct?: number;
  paymentStages?: readonly PackagePaymentStage[];
}

export interface StandardPackage {
  name: string;
  purpose: string;
  lines: readonly StandardPackageLine[];
  /** The old `counts` argument — only the keys the template set; the rest
   * stay at the shared zeroes. */
  counts: Partial<PackageCounts>;
  overrides?: StandardPackageOverrides;
}

/** :13426-13433, in the old file's order. */
export const STANDARD_PACKAGES: readonly StandardPackage[] = [
  {
    // :13426
    name: 'Basic Exhibition Listing',
    purpose: 'A clean, credible listing of the show on Darz.',
    lines: [{ service: 'Exhibition listing', count: 1 }],
    counts: { posts: 1, stories: 1 },
    overrides: {
      internal: {
        internalCost: 60,
        externalCost: 0,
        minFee: 120,
        recFee: 250,
        targetMargin: 50,
      },
      // the one template paid entirely on publication — no deposit
      depositPct: 0,
      paymentStages: [{ label: 'On publication', pct: 100 }],
    },
  },
  {
    // :13427
    name: 'Editorial Coverage',
    purpose: 'Written editorial coverage with Darz’s voice and context.',
    lines: [
      { service: 'Editorial article', count: 1 },
      { service: 'Exhibition review', count: 1 },
      { service: 'Social media post', count: 2 },
    ],
    counts: { articles: 1, posts: 2 },
    overrides: {
      internal: {
        internalCost: 430,
        externalCost: 0,
        minFee: 700,
        recFee: 1200,
        targetMargin: 45,
      },
    },
  },
  {
    // :13428
    name: 'Photography & Video Documentation',
    purpose: 'Professional documentation of the works and the space.',
    lines: [
      { service: 'Professional artwork documentation', count: 1 },
      { service: 'Installation photography', count: 6 },
      { service: 'Short-form video production', count: 1 },
    ],
    counts: { photos: 12, videos: 1, videoMin: 2 },
    overrides: {
      onsite: true,
      internal: {
        internalCost: 1000,
        externalCost: 200,
        minFee: 1600,
        recFee: 2600,
        targetMargin: 40,
      },
    },
  },
  {
    // :13429
    name: 'Artist Interview Package',
    purpose: 'A researched, edited interview presenting the artist.',
    lines: [
      { service: 'Artist interview (written)', count: 1 },
      { service: 'Curatorial research', count: 4 },
      { service: 'Social media post', count: 2 },
    ],
    counts: { interviews: 1, posts: 2 },
    overrides: {
      internal: {
        internalCost: 340,
        externalCost: 0,
        minFee: 600,
        recFee: 1000,
        targetMargin: 45,
      },
    },
  },
  {
    // :13430
    name: 'Complete Media Partnership',
    purpose: 'End-to-end media coverage across the run of the show.',
    lines: [
      { service: 'Exhibition listing', count: 1 },
      { service: 'Editorial article', count: 2 },
      { service: 'Social media post', count: 6 },
      { service: 'Short-form video production', count: 2 },
      { service: 'Darz channel distribution', count: 1 },
    ],
    counts: { articles: 2, posts: 6, videos: 2, stories: 6 },
    overrides: {
      onsite: true,
      internal: {
        internalCost: 1600,
        externalCost: 300,
        minFee: 2600,
        recFee: 4500,
        targetMargin: 42,
      },
    },
  },
  {
    // :13431
    name: 'Curatorial & Content Partnership',
    purpose: 'Curatorial framing plus the content to present it.',
    lines: [
      { service: 'Exhibition concept development', count: 1 },
      { service: 'Exhibition text & wall texts', count: 1 },
      { service: 'Artist & artwork selection', count: 1 },
      { service: 'Editorial article', count: 1 },
      { service: 'Short-form video production', count: 1 },
    ],
    counts: { articles: 1, videos: 1 },
    overrides: {
      onsite: true,
      internal: {
        internalCost: 2100,
        externalCost: 200,
        minFee: 3400,
        recFee: 5800,
        targetMargin: 45,
      },
    },
  },
  {
    // :13432
    name: 'Full Project Documentation & Archive',
    purpose: 'Complete documentation with a lasting Darz archive.',
    lines: [
      { service: 'Professional artwork documentation', count: 2 },
      { service: 'Installation photography', count: 10 },
      { service: 'Short-form video production', count: 2 },
      { service: 'Archive creation & handoff', count: 1 },
    ],
    counts: { photos: 20, videos: 2 },
    overrides: {
      onsite: true,
      internal: {
        internalCost: 1800,
        externalCost: 300,
        minFee: 2900,
        recFee: 4800,
        targetMargin: 40,
      },
      // the only template that keeps the archive for good
      archiveDuration: 'Permanent',
    },
  },
  {
    // :13433
    name: 'International English-Language Package',
    purpose: 'English-language presentation for international reach.',
    lines: [
      { service: 'English-language translation', count: 3 },
      { service: 'Artist interview (written)', count: 1 },
      { service: 'Editorial article', count: 1 },
      { service: 'Darz channel distribution', count: 1 },
    ],
    counts: { articles: 2, interviews: 1 },
    overrides: {
      internal: {
        internalCost: 780,
        externalCost: 0,
        minFee: 1300,
        recFee: 2200,
        targetMargin: 45,
      },
      usageRights: 'Darz international channels; full English rights.',
    },
  },
];

/* ── checklist templates (:13444-13447) ─────────────────────────────────── */

export interface StandardChecklist {
  name: string;
  /** The old `stage` key — all four are real `projects.stage` values, so
   * they carry over unchanged. */
  stage: ProjectStage;
  items: readonly string[];
}

/** :13444-13447, in the old file's order. */
export const STANDARD_CHECKLISTS: readonly StandardChecklist[] = [
  {
    name: 'Proposal checklist',
    stage: 'proposal',
    items: [
      'Confirm scope with the client',
      'Draft deliverables & counts',
      'Attach the pricing summary',
      'Set the client approval deadline',
    ],
  },
  {
    name: 'Shoot-day checklist',
    stage: 'production',
    items: [
      'Confirm venue access & time',
      'Prepare equipment list',
      'Shot list agreed with the client',
      'Backup & label files same day',
    ],
  },
  {
    name: 'Publication checklist',
    stage: 'publication',
    items: [
      'Final internal review passed',
      'Client approval recorded',
      'Captions & credits verified',
      'Scheduled across Darz channels',
    ],
  },
  {
    name: 'Archive handoff',
    stage: 'archive',
    items: [
      'Collect all final assets',
      'Write the post-project report',
      'File to the Darz archive',
      'Confirm retention duration',
    ],
  },
];

/** What the card's copy counts, derived from the arrays themselves. */
export const STANDARD_SET_COUNTS = {
  services: STANDARD_SERVICES.length,
  packages: STANDARD_PACKAGES.length,
  checklists: STANDARD_CHECKLISTS.length,
};

/* ── the plan (idempotency by name) ─────────────────────────────────────── */

/** The one name rule every plan and every lookup uses: trimmed, case-folded.
 * (The old panel matched deliverables the same way, `_doApplyPackage`
 * :14006.) */
export function nameKey(s: string): string {
  return s.trim().toLowerCase();
}

/** Two names are the same line: trimmed, case-insensitive. */
export function sameName(a: string, b: string): boolean {
  return nameKey(a) === nameKey(b);
}

/** A row already in the catalogue / the templates — only its name matters. */
export interface NamedRow {
  name: string;
}

/** What a run would do: `create` is written, `skip` is already there. */
export interface StandardPlan<T> {
  create: T[];
  skip: T[];
}

function plan<T extends { name: string }>(
  standard: readonly T[],
  existing: readonly NamedRow[],
): StandardPlan<T> {
  const create: T[] = [];
  const skip: T[] = [];
  for (const s of standard) {
    if (existing.some((e) => sameName(e.name, s.name))) skip.push(s);
    else create.push(s);
  }
  return { create, skip };
}

/** Never duplicates and never overwrites: a name already in the catalogue is
 * skipped, whatever its price — so a half-finished run resumes by clicking
 * again, and an edited line is left alone. */
export function planServices(existing: readonly NamedRow[]): StandardPlan<StandardService> {
  return plan(STANDARD_SERVICES, existing);
}

export function planPackages(existing: readonly NamedRow[]): StandardPlan<StandardPackage> {
  return plan(STANDARD_PACKAGES, existing);
}

export function planChecklists(
  existing: readonly NamedRow[],
): StandardPlan<StandardChecklist> {
  return plan(STANDARD_CHECKLISTS, existing);
}

/* ── API bodies ─────────────────────────────────────────────────────────── */

/** `POST …/service-catalog/`. The money fields are `Format: decimal`, so the
 * wire wants strings (the service editor sends them the same way,
 * `PackagesPage.saveSvc`). `currency` is the caller's — `STANDARD_CURRENCY`
 * when the options serve it, the desk's default otherwise. */
export function serviceInput(s: StandardService, currency: string): ServiceCatalogItemInput {
  return {
    name: s.name,
    category: s.category,
    unit: s.unit,
    internal_cost: String(s.internalCost),
    price: String(s.price),
    currency: currency as ServiceCatalogItemInput['currency'],
  };
}

/** Index the real catalogue for `packageInput` / `missingServices`: keyed by
 * `nameKey`, so a template's named line finds the id the API gave the row.
 * First row wins, so a later duplicate name never steals the link. */
export function serviceIdIndex(
  rows: readonly { id: string; name: string }[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rows) {
    const k = nameKey(r.name);
    if (!out.has(k)) out.set(k, r.id);
  }
  return out;
}

/** The names this template could not resolve against the catalogue — the
 * desk reports them rather than letting the package go out short. */
export function missingServices(p: StandardPackage, idByName: Map<string, string>): string[] {
  const out: string[] = [];
  for (const l of p.lines) {
    if (!idByName.has(nameKey(l.service)) && !out.includes(l.service)) out.push(l.service);
  }
  return out;
}

/**
 * `POST …/packages/`. The template's own values over `blankPackage()` — the
 * :13954 defaults the old `pkg()` base is (:13424) — so a field the old
 * `extra` did not set keeps exactly the old default.
 *
 * A line whose service is not in the index is DROPPED (a dangling id would
 * make the card read "(removed service)" and the apply write a deliverable
 * for nothing). The drop is silent HERE by design: call `missingServices`
 * first and say so on screen — never create a short package without telling
 * the owner which lines it lost.
 */
export function packageInput(
  p: StandardPackage,
  idByName: Map<string, string>,
): PackageTemplateInput {
  const base = blankPackage();
  const o = p.overrides ?? {};
  const lines: PackageLine[] = [];
  for (const l of p.lines) {
    const id = idByName.get(nameKey(l.service));
    if (id) lines.push({ svcId: id, count: l.count });
  }
  return {
    ...base,
    name: p.name,
    purpose: p.purpose,
    lines,
    counts: { ...asCounts(base.counts), ...p.counts } satisfies PackageCounts,
    onsite: o.onsite ?? base.onsite,
    usage_rights: o.usageRights ?? base.usage_rights,
    archive_duration: o.archiveDuration ?? base.archive_duration,
    internal: o.internal ?? base.internal,
    deposit_pct: o.depositPct ?? base.deposit_pct,
    payment_stages: o.paymentStages ? [...o.paymentStages] : base.payment_stages,
  };
}

/** `POST …/checklists/` — the items are plain strings (`asChecklistStrings`). */
export function checklistInput(c: StandardChecklist): ChecklistTemplateInput {
  return { name: c.name, stage: c.stage, items: [...c.items] };
}
