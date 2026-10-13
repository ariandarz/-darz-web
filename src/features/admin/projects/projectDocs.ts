/**
 * projectDocs — the pure half of the project's Proposal + Invoice builder
 * (backend 2026-10-01: `/projects/admin/projects/{id}/documents/`,
 * `kind` project_proposal | project_invoice, `ref` = the project's id).
 *
 * The backend stores `fields` verbatim; this file composes it. One object
 * carries two things:
 *  1. **the composer's own inputs** — the old `_propSave` payload
 *     (`darz-studio.html:14094`): `title`, `client`, `projectName`, `intro`,
 *     `notes`, `pricing` (auto | on | off) — plus this port's `reference`,
 *     `currency` and, on an invoice, the payment note, terms and bank. A
 *     saved draft reopens from these exactly as typed;
 *  2. **the PDF snapshot** in the shared renderer's `DocumentPdfFields`
 *     shape — the package as it stood at save time, never re-derived later.
 *
 * The proposal's sections follow the old composer's render (`_proposalHTML`,
 * `:14537-14634`): Introduction, the services, Deliverables, Timeline, the
 * Investment (lines + total, payment schedule, add-ons) and "Notes & terms"
 * (the notes first, then the package's terms).
 *
 * **There is no project invoice in the old app** — the Projects area only
 * kept an invoice STATUS (`:13801`). The invoice here is the exhibition
 * services invoice's shape (`exhibitions/issueForm.ts`, the golden invoice
 * fixture) filled from the project and its package: billed to, the priced
 * lines, total due, payment note, terms, bank block. Flagged as such.
 */
import type {
  PackageTemplateAdmin,
  ProjectAdmin,
  ProjectDocKind,
  ServiceCatalogItemAdmin,
} from '../../../api/types';
import { EMPTY_BANK, bankFromFields } from '../exhibitions/bankDetails';
import type { BankDetails } from '../exhibitionForm';
import type { DocumentPdfFields } from '../pdf/renderPdf';
import {
  asAddons,
  asCounts,
  asPackageLines,
  asPackagePaymentStages,
  buildProposalFields,
  projMoney,
  projN,
} from './projectForm';

export type PricingMode = 'auto' | 'on' | 'off';

/** :14061 — the owner's pricing switch, in its order. */
export const PRICING_MODES: ReadonlyArray<{ value: PricingMode; label: string }> = [
  { value: 'auto', label: 'Automatic' },
  { value: 'on', label: 'With pricing' },
  { value: 'off', label: 'Without pricing' },
];

/** The two kinds, their reference series (`doc-reference.js`: PRO is shared
 * with the exhibition proposals, SINV with the exhibition invoices — see
 * `exhibitionForm.ts::SERIES_KINDS`) and their words. */
export const PROJECT_DOCS: Record<
  ProjectDocKind,
  {
    code: string;
    label: string;
    word: string;
    render: 'exhibition_proposal' | 'exhibition_invoice';
  }
> = {
  project_proposal: {
    code: 'PRO',
    label: 'Project proposal',
    word: 'Proposal',
    render: 'exhibition_proposal',
  },
  project_invoice: {
    code: 'SINV',
    label: 'Services invoice',
    word: 'Invoice',
    render: 'exhibition_invoice',
  },
};

export interface ComposerDraft {
  kind: ProjectDocKind;
  title: string;
  client: string;
  projectName: string;
  intro: string;
  notes: string;
  pricing: PricingMode;
  reference: string;
  currency: string;
  /** invoice only — "Note from Darz" (the payment note) */
  note: string;
  /** invoice only — "Payment terms" */
  terms: string;
  /** invoice only */
  bank: BankDetails;
}

type Pkg = Partial<
  Pick<
    PackageTemplateAdmin,
    | 'name'
    | 'purpose'
    | 'lines'
    | 'counts'
    | 'onsite'
    | 'addons'
    | 'payment_stages'
    | 'prod_timeline'
    | 'pub_timeline'
    | 'revisions'
    | 'archive_duration'
    | 'usage_rights'
    | 'approval'
    | 'client_resp'
    | 'materials'
    | 'cancellation'
  >
>;
type Catalog = Array<Pick<ServiceCatalogItemAdmin, 'id' | 'name' | 'category' | 'price'>>;

const str = (v: unknown): string => (v == null ? '' : String(v));
const isMode = (v: unknown): v is PricingMode => v === 'auto' || v === 'on' || v === 'off';

/**
 * The composer's starting state (`proposal()` init, `:14033-14042`): a saved
 * draft's own values first, else the package / project defaults — the title
 * is the package's name (else "Proposal"), the client the project's linked
 * org or typed name, the project name the project's, pricing Automatic.
 */
export function composerFrom(
  kind: ProjectDocKind,
  project: Pick<ProjectAdmin, 'name' | 'client_name' | 'client_partner_org'>,
  pkg: Pick<Pkg, 'name'> | null,
  saved: unknown,
  defaults: { reference: string; currency: string; bank?: BankDetails },
): ComposerDraft {
  const f = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
  const client = project.client_partner_org?.name || project.client_name || '';
  return {
    kind,
    title:
      str(f.title) || (kind === 'project_proposal' ? pkg?.name || 'Proposal' : project.name),
    client: str(f.client) || client,
    projectName: str(f.projectName) || project.name || '',
    intro: str(f.intro),
    notes: str(f.notes),
    pricing: isMode(f.pricing) ? f.pricing : 'auto',
    reference: str(f.reference) || defaults.reference,
    currency: str(f.currency) || defaults.currency,
    note: str(f.note),
    terms: str(f.terms),
    bank: bankFromFields(f) ?? defaults.bank ?? { ...EMPTY_BANK },
  };
}

/** The lines' total at catalogue prices (price × count). The old composer
 * preferred the package's `internal.recFee` (`:14054`); that field is
 * "internal only, never client-facing" on this backend, so a document's
 * figure is always the lines' own sum — what the client can add up. */
export function packageTotal(pkg: Pick<Pkg, 'lines'>, catalog: Catalog): number {
  let total = 0;
  for (const l of asPackageLines(pkg.lines)) {
    const s = catalog.find((c) => c.id === l.svcId);
    if (s) total += projN(s.price) * l.count;
  }
  return Math.round(total * 100) / 100;
}

/** :14056 — a price exists when the lines total something or an add-on is
 * priced. Owner-only in the old panel; the caller passes that gate in. */
export function priceExists(pkg: Pick<Pkg, 'lines' | 'addons'>, catalog: Catalog): boolean {
  return packageTotal(pkg, catalog) > 0 || asAddons(pkg.addons).some((a) => a.price > 0);
}

/** :14057-14058 — "3 service lines · 12 deliverables · investment 1,200 T"
 * or "… · no price entered." (also for a login that may not see money, as in
 * the old card, whose `money` gate fed `priceExists`). */
export function packageSummary(
  pkg: Pick<Pkg, 'lines' | 'counts' | 'addons'>,
  catalog: Catalog,
  canMoney: boolean,
  currency: string,
): string {
  const n = asPackageLines(pkg.lines).length;
  const c = asCounts(pkg.counts);
  const delc = c.posts + c.stories + c.articles + c.interviews + c.photos + c.videos;
  const priced = canMoney && priceExists(pkg, catalog);
  return (
    `${n} service line${n === 1 ? '' : 's'} · ${delc} deliverable${delc === 1 ? '' : 's'}` +
    (priced
      ? ` · investment ${projMoney(packageTotal(pkg, catalog), currency)}`
      : ' · no price entered') +
    '.'
  );
}

/** :14062 — the line under the pricing switch, verbatim. */
export function pricingNote(mode: PricingMode, priced: boolean): string {
  if (mode === 'off') return 'The proposal will send without any pricing.';
  if (!priced)
    return 'No price is entered on this package — the non-priced version is created automatically.';
  if (mode === 'on') return 'The investment and payment schedule will be shown.';
  return 'Pricing shows automatically because a price is set.';
}

/** :14556-14557 — `(mode !== 'off') && hasPrice`, where `hasPrice` needs the
 * owner login. So "With pricing" cannot force money onto a package with
 * none: it renders exactly as "Automatic" (the old behaviour, kept). */
export function showsPricing(mode: PricingMode, canMoney: boolean, priced: boolean): boolean {
  return mode !== 'off' && canMoney && priced;
}

/** :14559-14560 — "Prepared for Client · Project", the project only when it
 * says something the client name does not. */
export function preparedFor(client: string, projectName: string): string {
  const pf = [client.trim(), projectName.trim() !== client.trim() ? projectName.trim() : '']
    .filter(Boolean)
    .join(' · ');
  return pf ? `Prepared for ${pf}` : '';
}

/** :14584-14588 — the package's deliverable counts as label/value rows. */
export function deliverableRows(pkg: Pick<Pkg, 'counts' | 'onsite'>): Array<[string, string]> {
  const c = asCounts(pkg.counts);
  const rows: Array<[string, string]> = [];
  for (const [k, label] of [
    ['posts', 'Social posts'],
    ['stories', 'Stories'],
    ['articles', 'Editorial articles'],
    ['interviews', 'Interviews'],
    ['photos', 'Photographs'],
    ['videos', 'Videos'],
  ] as const)
    if (c[k] > 0) rows.push([label, String(c[k])]);
  if (c.videoMin > 0) rows.push(['Video runtime', `${c.videoMin} min`]);
  // the old card's "✓" (:14588) — not a glyph the PDF's embedded Barlow has
  if (pkg.onsite) rows.push(['On-site production', 'Included']);
  return rows;
}

/** :14591-14596 — the package's timeline rows. */
export function timelineRows(
  pkg: Pick<Pkg, 'prod_timeline' | 'pub_timeline' | 'revisions' | 'archive_duration'>,
): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (pkg.prod_timeline) rows.push(['Production', pkg.prod_timeline]);
  if (pkg.pub_timeline) rows.push(['Publication', pkg.pub_timeline]);
  const r = projN(pkg.revisions);
  if (r > 0) rows.push(['Revisions', `${r} round${r === 1 ? '' : 's'}`]);
  if (pkg.archive_duration) rows.push(['Archive', pkg.archive_duration]);
  return rows;
}

/** :14612-14616 — the package's own terms, under the notes. */
export function packageTermRows(
  pkg: Pick<Pkg, 'usage_rights' | 'approval' | 'client_resp' | 'materials' | 'cancellation'>,
): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  if (pkg.usage_rights) rows.push(['Usage rights', pkg.usage_rights]);
  if (pkg.approval) rows.push(['Approval', pkg.approval]);
  if (pkg.client_resp) rows.push(['Client responsibilities', pkg.client_resp]);
  if (pkg.materials) rows.push(['Required materials', pkg.materials]);
  if (pkg.cancellation) rows.push(['Cancellation', pkg.cancellation]);
  return rows;
}

/** The money taken off a snapshot — the old "calm non-priced version"
 * (`:14028`): no line price (the renderer prints "On confirmation"), no
 * totals block, and so no schedule or add-ons either. */
function stripPrices(f: DocumentPdfFields): void {
  f.lines = (f.lines ?? []).map((l) => ({ ...l, price: '' }));
  delete f.subtotal;
  delete f.discount;
  delete f.total;
  delete f.schedule;
  delete f.addons;
}

/**
 * The `fields` a project document is created / saved with.
 *
 * `money` says whether the catalogue's prices may go on it at all: the owner
 * login AND a chosen currency the lines are actually priced in (no exchange
 * rate exists here — `ProjectProposal.tsx::carriesCataloguePrices`). A
 * proposal without it — or switched to "Without pricing", or with no price
 * entered — goes out as the non-priced version. An invoice is never issued
 * without it (the composer blocks that), so its prices always stand.
 */
export function buildProjectDocFields(
  project: Partial<Pick<ProjectAdmin, 'no' | 'name' | 'venue' | 'start_date' | 'end_date'>>,
  pkg: Pkg,
  catalog: Catalog,
  d: ComposerDraft,
  opts: { money: boolean; issuedAt?: string },
): DocumentPdfFields & Record<string, unknown> {
  const invoice = d.kind === 'project_invoice';
  const base = buildProposalFields(project, pkg, catalog, {
    reference: d.reference,
    currency: d.currency,
    clientName: d.client,
    note: invoice ? d.note : '',
    terms: invoice ? d.terms : '',
    issuedAt: opts.issuedAt,
  });
  const composer = {
    title: d.title,
    client: d.client,
    projectName: d.projectName,
    intro: invoice ? '' : d.intro,
    notes: invoice ? '' : d.notes,
    pricing: invoice ? ('on' as const) : d.pricing,
  };

  if (invoice) {
    return {
      ...base,
      ...composer,
      doc_label: PROJECT_DOCS.project_invoice.label,
      lines_label: 'Project services',
      counterparty_label: 'From the client',
      show: {
        ...base.show,
        title: d.projectName || project.name || '',
        gallery: '',
        artists: '',
      },
      billed_to: d.client,
      bank: d.bank,
    };
  }

  const total = base.total ?? 0;
  const priced = priceExists(pkg, catalog);
  const f: DocumentPdfFields & Record<string, unknown> = {
    ...base,
    ...composer,
    doc_label: PROJECT_DOCS.project_proposal.label,
    show: { ...base.show, title: d.title || pkg.name || 'Proposal' },
    prepared_for: preparedFor(d.client, d.projectName),
    intro: d.intro,
    sections: [
      { label: 'Deliverables', rows: deliverableRows(pkg) },
      { label: 'Timeline', rows: timelineRows(pkg) },
    ].filter((s) => s.rows.length > 0),
    schedule: asPackagePaymentStages(pkg.payment_stages).map((s) => {
      const amt = total ? Math.round((total * s.pct) / 100) : 0;
      return { label: (s.label || 'Stage') + (s.pct ? ` · ${s.pct}%` : ''), amount: amt };
    }),
    addons: asAddons(pkg.addons)
      .filter((a) => a.price > 0)
      .map((a) => ({
        name: a.name || 'Add-on',
        price: a.price,
        currency: a.currency || d.currency,
      })),
    terms: d.notes,
    terms_label: 'Notes & terms',
    terms_rows: packageTermRows(pkg),
  };
  if (!opts.money || !showsPricing(d.pricing, true, priced)) stripPrices(f);
  return f;
}

/** A document's status in words: the old proposal's two (`:14065` "Draft" /
 * "Final") over the server's draft → confirmed, then the signature. */
export function docStatusWord(d: { status: string; signed_at?: string | null }): string {
  if (d.status === 'draft') return 'Draft';
  if (d.status === 'confirmed') return d.signed_at ? 'Final · signed by Darz' : 'Final';
  if (d.status === 'archived') return 'Archived';
  return d.status;
}
