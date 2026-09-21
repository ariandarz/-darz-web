/** The Projects group's pure logic — guards that never throw, the order-based
 * scope gate, the flags that mirror `services.py:208-232`, package apply,
 * catalogue-priced quotes and the proposal blob. */
import { describe, expect, it } from 'vitest';
import type { Choice, ServiceCatalogItemAdmin } from '../../../api/types';
import {
  applyPackage,
  asAddons,
  asChecklistStrings,
  asCounts,
  asDeliverables,
  asInternal,
  asLanes,
  asLinks,
  asMoney,
  asPackageLines,
  asPackagePaymentStages,
  asStages,
  asStringList,
  awaitsApproval,
  blankPackage,
  buildProposalFields,
  calcQuote,
  choiceLabel,
  choices,
  DASH_CARDS,
  defaultCurrency,
  DELIV_CLASSES,
  GATE_STAGES,
  isActive,
  isDelayed,
  isQuick,
  lanesToRoles,
  matchesQuick,
  moneyCalc,
  nextDeliverables,
  nextDelText,
  packageLineTotal,
  parseList,
  projFlag,
  projMoney,
  projN,
  QUICK,
  QUICK_LABELS,
  quoteToMoney,
  REVIEW_STAGES,
  scopeByCat,
  scopeGate,
  stageDue,
  stageIndex,
  stageLabel,
  stageState,
  svcName,
  uid,
  unpaidCount,
} from './projectForm';

/** The backend's `projects.stage` choices, in pipeline order (:13235). */
const STAGES: Choice[] = [
  ['lead', 'Lead'],
  ['qualification', 'Qualification'],
  ['brief', 'Initial Brief'],
  ['proposal', 'Proposal'],
  ['scopeApproval', 'Scope Approval'],
  ['contract', 'Contract'],
  ['deposit', 'Deposit'],
  ['research', 'Research'],
  ['planning', 'Content Planning'],
  ['production', 'Production'],
  ['internalReview', 'Internal Review'],
  ['clientReview', 'Client Review'],
  ['finalApproval', 'Final Approval'],
  ['publication', 'Publication'],
  ['reporting', 'Reporting'],
  ['finalPayment', 'Final Payment'],
  ['archive', 'Archive'],
].map(([value, label]) => ({ value, label }));

const SVC_CATS: Choice[] = [
  { value: 'media', label: 'Media' },
  { value: 'production', label: 'Production' },
  { value: 'curatorial', label: 'Curatorial' },
  { value: 'other', label: 'Other' },
];

const svc = (
  id: string,
  name: string,
  category: ServiceCatalogItemAdmin['category'],
  price: string,
  internal_cost = '0',
): ServiceCatalogItemAdmin => ({
  id,
  name,
  category,
  unit: 'piece',
  internal_cost,
  price,
  currency: 'USD',
  version: 1,
  created_at: '',
  updated_at: '',
});

const CATALOG = [
  svc('s-photo', 'Photo coverage', 'production', '700', '300'),
  svc('s-post', 'Instagram post', 'media', '100', '20'),
  svc('s-essay', 'Curatorial essay', 'curatorial', '1200', '500'),
];

const TODAY = '2026-09-19';

describe('guards never throw on garbage', () => {
  it('asDeliverables drops non-object rows and defaults every key', () => {
    expect(asDeliverables(null)).toEqual([]);
    expect(asDeliverables('nope')).toEqual([]);
    expect(asDeliverables([1, 'x', { text: 'Essay', done: 'true' }])).toEqual([
      { id: '', text: 'Essay', due: '', owner: '', done: true, depId: '' },
    ]);
  });
  it('asMoney reads the backend `currency` key and the old `cur`', () => {
    const m = asMoney(
      {
        fee: { amount: 1200, cur: 'EUR' },
        clientPrice: { amount: '2,000', currency: 'USD' },
        payments: [{ id: 'p1', label: 'Deposit', amount: '500', paid: 1 }, 'junk'],
        invoiceStatus: 'weird',
      },
      'TMN',
    );
    expect(m.fee).toEqual({ amount: '1200', currency: 'EUR' });
    expect(m.clientPrice).toEqual({ amount: '2,000', currency: 'USD' });
    expect(m.internalCost).toEqual({ amount: '', currency: 'TMN' });
    expect(m.payments).toEqual([
      { id: 'p1', label: 'Deposit', amount: '500', currency: 'TMN', due: '', paid: true },
    ]);
    expect(m.invoiceStatus).toBe('none');
    expect(asMoney(42, 'USD').payments).toEqual([]);
  });
  it('asStages keeps approval flags only when they are real booleans', () => {
    expect(asStages([])).toEqual({});
    const s = asStages({
      lead: {
        due: '2026-01-01',
        intApproved: 'no',
        cliApproved: false,
        deps: 'a, b',
        doneTs: '0',
      },
      bad: 7,
    });
    expect(Object.keys(s)).toEqual(['lead']);
    expect(s.lead).toMatchObject({
      due: '2026-01-01',
      cliApproved: false,
      deps: ['a', 'b'],
      doneTs: 0,
    });
    expect('intApproved' in s.lead).toBe(false);
  });
  it('asLanes reads the dict, the legacy role string and the old array form', () => {
    expect(asLanes(null)).toEqual([]);
    const lanes = asLanes({
      'org-1': { role: 'media', delivClass: 'social', status: 'at-risk' },
      'org-2': 'editorial',
      'org-3': 3,
    });
    expect(lanes).toHaveLength(2);
    expect(lanes[0]).toMatchObject({ orgId: 'org-1', role: 'media', status: 'at-risk' });
    expect(lanes[1]).toMatchObject({ orgId: 'org-2', role: 'editorial', status: 'on-track' });
    expect(asLanes([{ orgId: 'x', role: 'content', status: 'bogus' }, {}])).toEqual([
      expect.objectContaining({ orgId: 'x', role: 'content', status: 'on-track' }),
    ]);
  });
  it('lanesToRoles keys by org and drops lanes without one', () => {
    const [a, b] = asLanes({ 'org-1': 'media', 'org-2': 'archive' });
    const roles = lanesToRoles([a, b, { ...a, orgId: '' }]);
    expect(Object.keys(roles)).toEqual(['org-1', 'org-2']);
    expect(roles['org-2'].role).toBe('archive');
  });
  it('the small guards default cleanly', () => {
    expect(asLinks([{ label: 'Site', url: 'https://x' }, 'x'])).toEqual([
      { label: 'Site', url: 'https://x' },
    ]);
    expect(asStringList(['a', ' b ', 3, null, ''])).toEqual(['a', 'b', '3']);
    expect(asStringList('a, b')).toEqual(['a', 'b']);
    expect(asStringList({})).toEqual([]);
    expect(asPackageLines([{ svcId: 's1', count: '0' }, { count: 2 }, 'x'])).toEqual([
      { svcId: 's1', count: 1 },
    ]);
    expect(asCounts({ posts: '4', videoMin: 'lots' })).toMatchObject({
      posts: 4,
      videoMin: 0,
      stories: 0,
    });
    expect(asAddons([{ name: 'Reel', price: '250', cur: 'USD' }])).toEqual([
      { name: 'Reel', price: 250, currency: 'USD' },
    ]);
    expect(asPackagePaymentStages([{ label: 'Deposit', pct: '50' }, null])).toEqual([
      { label: 'Deposit', pct: 50 },
    ]);
    expect(asInternal('x')).toEqual({
      internalCost: 0,
      externalCost: 0,
      minFee: 0,
      recFee: 0,
      targetMargin: 0,
    });
    expect(asChecklistStrings(['Brief signed', { text: 'Deposit in' }, '', 5])).toEqual([
      'Brief signed',
      'Deposit in',
    ]);
  });
});

describe('helpers (:13281-13294)', () => {
  it('projN / projMoney / parseList', () => {
    expect(projN('1,200 USD')).toBe(1200);
    expect(projN(null)).toBe(0);
    expect(projN('-3.5')).toBe(-3.5);
    expect(projMoney('1234.6', 'USD')).toBe('1,235 USD');
    expect(projMoney(0)).toBe('0');
    expect(parseList(' a, b ,,c ')).toEqual(['a', 'b', 'c']);
  });
  it('uid carries the prefix and the timestamp', () => {
    expect(uid('dl', 1000)).toMatch(/^dl[0-9a-z]{2}[0-9a-z]{4}$/);
    expect(uid('', 1000).startsWith('p')).toBe(true);
  });
  it('options helpers fall back cleanly', () => {
    expect(choices(null, 'currency')).toEqual([]);
    expect(choices({ currency: 'x' }, 'currency')).toEqual([]);
    expect(defaultCurrency({ currency: [{ value: 'USD', label: 'US Dollar' }] })).toBe('USD');
    expect(defaultCurrency(null)).toBe('');
    expect(choiceLabel(STAGES, 'brief')).toBe('Initial Brief');
    expect(choiceLabel(STAGES, 'nope')).toBe('nope');
    expect(choiceLabel(DELIV_CLASSES, '')).toBe('');
  });
});

describe('stage machinery', () => {
  it('index / label / state follow the option order (:13291)', () => {
    expect(stageIndex(STAGES, 'deposit')).toBe(6);
    expect(stageIndex(STAGES, 'zzz')).toBe(-1);
    expect(stageLabel(STAGES, 'planning')).toBe('Content Planning');
    expect(stageState(STAGES, 'production', 'lead')).toBe('done');
    expect(stageState(STAGES, 'production', 'production')).toBe('active');
    expect(stageState(STAGES, 'production', 'archive')).toBe('wait');
    expect(stageState(STAGES, undefined, 'lead')).toBe('wait');
  });
  it('the vocabularies match the old tables', () => {
    expect(REVIEW_STAGES).toEqual(['internalReview', 'clientReview', 'finalApproval']);
    expect(GATE_STAGES).toEqual(['scopeApproval', 'contract', 'deposit']);
  });
});

describe('scopeGate (:13323, keyed on order)', () => {
  it('blocks a curatorial project short of the deposit and names what is still needed', () => {
    const g = scopeGate(
      { category: 'curatorial', stage: 'scopeApproval' },
      'research',
      STAGES,
    );
    expect(g.ok).toBe(false);
    if (!g.ok)
      expect(g.reason).toBe(
        'Curatorial work can’t begin until Scope Approval, Contract and Deposit are all recorded. Still needed: Contract, Deposit.',
      );
    const all = scopeGate({ category: 'mixed', stage: 'lead' }, 'production', STAGES);
    expect(all).toEqual({
      ok: false,
      reason:
        'Curatorial work can’t begin until Scope Approval, Contract and Deposit are all recorded. Still needed: Scope Approval, Contract, Deposit.',
    });
  });
  it('passes once the deposit stage is reached, for other targets, and for other categories', () => {
    expect(
      scopeGate({ category: 'curatorial', stage: 'deposit' }, 'research', STAGES),
    ).toEqual({
      ok: true,
    });
    expect(scopeGate({ category: 'mixed', stage: 'production' }, 'research', STAGES).ok).toBe(
      true,
    );
    expect(scopeGate({ category: 'curatorial', stage: 'lead' }, 'planning', STAGES).ok).toBe(
      true,
    );
    expect(scopeGate({ category: 'media', stage: 'lead' }, 'production', STAGES).ok).toBe(
      true,
    );
    expect(scopeGate({ category: 'curatorial', stage: 'lead' }, 'research', []).ok).toBe(true);
  });
});

describe('flags mirror services.py:208-232', () => {
  it('isActive: not archived and not in the archive stage', () => {
    expect(isActive({ stage: 'lead', archived: false })).toBe(true);
    expect(isActive({ stage: 'archive' })).toBe(false);
    expect(isActive({ stage: 'lead', archived: true })).toBe(false);
    expect(isActive({ stage: 'lead', status: 'Completed' })).toBe(true);
  });
  it('isDelayed: any stage entry past due without a doneTs', () => {
    expect(isDelayed({ stages: { brief: { due: '2026-09-01' } } }, TODAY)).toBe(true);
    expect(isDelayed({ stages: { brief: { due: '2026-09-01', doneTs: 5 } } }, TODAY)).toBe(
      false,
    );
    expect(isDelayed({ stages: { brief: { due: '2026-09-30' } } }, TODAY)).toBe(false);
    expect(isDelayed({ stages: 'garbage' }, TODAY)).toBe(false);
  });
  it('awaitsApproval: a literal false on either flag, on any stage', () => {
    expect(awaitsApproval({ stages: { lead: { intApproved: false } } })).toBe(true);
    expect(
      awaitsApproval({ stages: { clientReview: { cliApproved: false, intApproved: true } } }),
    ).toBe(true);
    expect(
      awaitsApproval({ stages: { clientReview: { intApproved: true, cliApproved: true } } }),
    ).toBe(false);
    expect(awaitsApproval({ stages: { clientReview: {} } })).toBe(false);
  });
  it('unpaidCount / nextDeliverables / nextDelText / stageDue', () => {
    const p = {
      stage: 'production' as const,
      stages: { production: { due: '2026-09-21' } },
      money: { payments: [{ paid: false, amount: '0' }, { paid: true }, { paid: 'no' }] },
      deliverables: [
        { id: 'a', text: 'Late one', due: '2026-09-10', done: false },
        { id: 'b', text: 'Soon', due: '2026-09-25', done: false },
        { id: 'c', text: 'Far', due: '2026-10-30', done: false },
        { id: 'd', text: 'Done', due: '2026-09-20', done: true },
        { id: 'e', text: 'Undated', due: '', done: false },
      ],
    };
    expect(unpaidCount(p)).toBe(2);
    expect(nextDeliverables(p, TODAY).map((d) => d.id)).toEqual(['a', 'b']);
    expect(nextDeliverables(p, 'not a date')).toEqual([]);
    expect(nextDelText(p)).toBe('Late one · 2026-09-10');
    expect(nextDelText({ deliverables: [{ text: '', done: false }] })).toBe('Deliverable');
    expect(nextDelText({})).toBe('—');
    expect(stageDue(p)).toBe('2026-09-21');
    expect(stageDue({ stage: 'lead' })).toBe('');
  });
  it('projFlag branches (:13309)', () => {
    expect(projFlag({ archived: true }, STAGES, TODAY)).toEqual({ c: 'wait', t: 'Archived' });
    expect(projFlag({ stage: 'archive' }, STAGES, TODAY)).toEqual({
      c: 'done',
      t: 'Archived',
    });
    expect(projFlag({ stage: 'lead', status: 'Completed' }, STAGES, TODAY)).toEqual({
      c: 'done',
      t: 'Completed',
    });
    expect(
      projFlag({ stage: 'brief', stages: { brief: { due: '2026-09-18' } } }, STAGES, TODAY),
    ).toEqual({ c: 'block', t: 'Overdue' });
    expect(
      projFlag({ stage: 'brief', stages: { brief: { due: '2026-09-21' } } }, STAGES, TODAY),
    ).toEqual({ c: 'attn', t: 'Due soon' });
    expect(
      projFlag({ stage: 'brief', stages: { brief: { due: '2026-09-22' } } }, STAGES, TODAY),
    ).toEqual({ c: 'active', t: 'Initial Brief' });
    expect(projFlag({ stage: 'planning' }, STAGES, TODAY)).toEqual({
      c: 'active',
      t: 'Content Planning',
    });
  });
  it('moneyCalc groups per currency and never converts (:13301)', () => {
    const r = moneyCalc(
      {
        money: {
          internalCost: { amount: '100', currency: 'USD' },
          externalCost: { amount: '50', currency: 'USD' },
          fee: { amount: '900', currency: 'EUR' },
          clientPrice: { amount: '0' },
          payments: [
            { amount: '300', currency: 'EUR', paid: true },
            { amount: '600', currency: 'EUR', paid: false },
            { amount: '', currency: 'USD' },
          ],
        },
      },
      'TMN',
    );
    expect(r.currencies).toEqual(['USD', 'EUR']);
    expect(r.byCur.USD).toMatchObject({ internal: 100, external: 50, fee: 0 });
    expect(r.byCur.EUR).toMatchObject({ fee: 900, paid: 300, due: 600 });
    expect(moneyCalc({}).currencies).toEqual([]);
  });
});

describe('quick filters (:13631-13635, :13646)', () => {
  it('QUICK / QUICK_LABELS / DASH_CARDS agree', () => {
    expect([...QUICK]).toEqual(['active', 'delayed', 'approval', 'deliverables', 'unpaid']);
    expect(QUICK_LABELS.deliverables).toBe('Deliverables ≤7d');
    expect(DASH_CARDS.map((c) => c.q)).toEqual([...QUICK]);
    expect(isQuick('unpaid')).toBe(true);
    expect(isQuick('all')).toBe(false);
  });
  it('matchesQuick gates every quick on isActive; unknown quick = no filter', () => {
    const active = { stage: 'brief' as const, stages: { brief: { due: '2026-01-01' } } };
    const archived = { ...active, archived: true };
    expect(matchesQuick(active, 'delayed', TODAY)).toBe(true);
    expect(matchesQuick(archived, 'delayed', TODAY)).toBe(false);
    expect(matchesQuick(archived, 'active', TODAY)).toBe(false);
    expect(matchesQuick(active, 'approval', TODAY)).toBe(false);
    expect(matchesQuick(active, 'unpaid', TODAY)).toBe(false);
    expect(
      matchesQuick({ ...active, money: { payments: [{ paid: false }] } }, 'unpaid', TODAY),
    ).toBe(true);
    expect(
      matchesQuick(
        { ...active, deliverables: [{ text: 'x', due: '2026-09-20', done: false }] },
        'deliverables',
        TODAY,
      ),
    ).toBe(true);
    expect(matchesQuick(archived, 'all', TODAY)).toBe(true);
    expect(matchesQuick(archived, undefined, TODAY)).toBe(true);
  });
});

describe('packages & pricing', () => {
  it('svcName / packageLineTotal / scopeByCat (:13334-13336)', () => {
    expect(svcName(CATALOG, 's-post')).toBe('Instagram post');
    expect(svcName(CATALOG, 'gone')).toBe('(removed service)');
    const lines = [
      { svcId: 's-photo', count: 2 },
      { svcId: 's-post', count: 3 },
      { svcId: 'gone', count: 1 },
    ];
    expect(packageLineTotal({ lines }, CATALOG)).toBe(1700);
    expect(packageLineTotal({ lines: 'junk' }, CATALOG)).toBe(0);
    const scope = scopeByCat(lines, CATALOG, SVC_CATS);
    expect(scope.map((s) => [s.cat, s.included])).toEqual([
      ['media', true],
      ['production', true],
      ['curatorial', false],
      ['other', false],
    ]);
    expect(scope[1].items).toEqual([{ name: 'Photo coverage', count: 2, price: 700 }]);
    expect(scope[2].items).toEqual([]);
  });
  it('blankPackage carries the :13954 defaults verbatim', () => {
    const b = blankPackage();
    expect(b).toMatchObject({
      name: '',
      revisions: 1,
      approval: 'One internal + one client review.',
      usage_rights: 'Darz channels; client re-use with credit.',
      archive_duration: '12 months',
      deposit_pct: 50,
      cancellation: 'Deposit non-refundable once work has begun.',
      payment_stages: [
        { label: 'Deposit', pct: 50 },
        { label: 'On delivery', pct: 50 },
      ],
      onsite: false,
    });
    expect(asCounts(b.counts)).toEqual({
      posts: 0,
      stories: 0,
      articles: 0,
      interviews: 0,
      photos: 0,
      videos: 0,
      videoMin: 0,
    });
    expect(asInternal(b.internal)).toEqual({
      internalCost: 0,
      externalCost: 0,
      minFee: 0,
      recFee: 0,
      targetMargin: 40,
    });
  });
  it('applyPackage appends new deliverables only, and builds money + payments (:14002-14013)', () => {
    const pkg = {
      id: 'pkg-1',
      lines: [
        { svcId: 's-photo', count: 2 },
        { svcId: 's-post', count: 1 },
        { svcId: 's-essay', count: 1 },
      ],
      internal: { internalCost: 800, externalCost: 200, recFee: 3000, targetMargin: 40 },
      payment_stages: [
        { label: 'Deposit', pct: 50 },
        { label: 'On delivery', pct: 50 },
      ],
    };
    const p = {
      deliverables: [
        { id: 'd0', text: 'instagram POST', due: '', owner: '', done: false, depId: '' },
      ],
      money: { invoiceStatus: 'sent', fee: { amount: '1', currency: 'EUR' } },
    };
    const patch = applyPackage(p, pkg, CATALOG, 'USD', 1_700_000_000_000);
    expect(patch.applied_package).toBe('pkg-1');
    const dl = patch.deliverables as Array<{ id: string; text: string }>;
    expect(dl.map((d) => d.text)).toEqual([
      'instagram POST',
      '2× Photo coverage',
      'Curatorial essay',
    ]);
    expect(dl[1].id).toMatch(/^dl/);
    const money = patch.money as ReturnType<typeof asMoney>;
    expect(money.internalCost).toEqual({ amount: '800', currency: 'USD' });
    expect(money.externalCost).toEqual({ amount: '200', currency: 'USD' });
    expect(money.fee).toEqual({ amount: '3000', currency: 'USD' });
    expect(money.clientPrice).toEqual({ amount: '3000', currency: 'USD' });
    expect(money.invoiceStatus).toBe('sent');
    expect(money.payments.map((x) => [x.label, x.amount, x.paid])).toEqual([
      ['Deposit', '1500', false],
      ['On delivery', '1500', false],
    ]);
  });
  it('applyPackage with no recFee leaves amounts blank', () => {
    const patch = applyPackage(
      {},
      { id: 'k', lines: [], internal: {}, payment_stages: [{ label: 'Deposit', pct: 50 }] },
      CATALOG,
      'EUR',
      1,
    );
    const money = patch.money as ReturnType<typeof asMoney>;
    expect(money.fee).toEqual({ amount: '', currency: 'EUR' });
    expect(money.payments[0]).toMatchObject({ label: 'Deposit', amount: '', currency: 'EUR' });
    expect(money.invoiceStatus).toBe('none');
    expect(patch.deliverables).toEqual([]);
  });
});

describe('calculator (D21 — priced from the catalogue)', () => {
  const lines = [
    { svcId: 's-photo', count: 2 },
    { svcId: 's-essay', count: 1 },
    { svcId: 'gone', count: 9 },
  ];
  it('calcQuote arithmetic with a discount', () => {
    const q = calcQuote(lines, CATALOG, { discountPct: '10', depositPct: 50 });
    expect(q.internal).toBe(1100);
    expect(q.price).toBe(2600);
    expect(q.discountPct).toBe(10);
    expect(q.approved).toBeCloseTo(2340);
    expect(q.gross).toBeCloseTo(1240);
    expect(q.margin).toBeCloseTo((1240 / 2340) * 100);
    expect(q.deposit).toBeCloseTo(1170);
    expect(q.remaining).toBeCloseTo(1170);
  });
  it('approvedPrice overrides the recommended price; empty means none', () => {
    const q = calcQuote(lines, CATALOG, {
      discountPct: 10,
      approvedPrice: '2,000',
      depositPct: 30,
    });
    expect(q.approved).toBe(2000);
    expect(q.gross).toBe(900);
    expect(q.margin).toBe(45);
    expect(q.deposit).toBe(600);
    expect(q.remaining).toBe(1400);
    expect(calcQuote(lines, CATALOG, { approvedPrice: '   ' }).approved).toBe(2600);
    expect(calcQuote([], CATALOG, {}).margin).toBe(0);
  });
  it('quoteToMoney (:15358) writes the four amounts and two stages', () => {
    const q = calcQuote(lines, CATALOG, { approvedPrice: 2000, depositPct: 30 });
    const m = quoteToMoney(q, 'USD', 5);
    expect(m.internalCost).toEqual({ amount: '1100', currency: 'USD' });
    expect(m.externalCost).toEqual({ amount: '', currency: 'USD' });
    expect(m.fee).toEqual({ amount: '900', currency: 'USD' });
    expect(m.clientPrice).toEqual({ amount: '2000', currency: 'USD' });
    expect(m.payments.map((x) => [x.label, x.amount])).toEqual([
      ['Deposit', '600'],
      ['On delivery', '1400'],
    ]);
    expect(m.invoiceStatus).toBe('none');
  });
});

describe('buildProposalFields — the DocumentPdfFields snapshot', () => {
  it('prices lines from the catalogue, skips removed services, totals = lines', () => {
    const f = buildProposalFields(
      {
        no: 'P-0007',
        name: 'Winter show',
        venue: 'Main hall',
        start_date: '2026-10-01',
        end_date: '2026-10-20',
      },
      {
        lines: [
          { svcId: 's-photo', count: 3 },
          { svcId: 'gone', count: 1 },
          { svcId: 's-post', count: 1 },
        ],
      },
      CATALOG,
      {
        reference: 'DARZ-PRO-2026-0001',
        currency: 'USD',
        clientName: 'Gallery X',
        note: 'Hi',
        issuedAt: TODAY,
      },
    );
    expect(f).toEqual({
      reference: 'DARZ-PRO-2026-0001',
      doc_label: 'Project proposal',
      lines_label: 'Proposed for this project',
      counterparty_label: 'From the client',
      issued_at: TODAY,
      show: {
        title: 'Winter show',
        gallery: 'Gallery X',
        artists: '',
        dates: '2026-10-01–2026-10-20',
        venue: 'Main hall',
        project: 'P-0007',
      },
      lines: [
        { title: '3× Photo coverage', description: '', price: '2,100', currency: 'USD' },
        { title: 'Instagram post', description: '', price: '100', currency: 'USD' },
      ],
      currency: 'USD',
      subtotal: 2200,
      discount: 0,
      total: 2200,
      note: 'Hi',
      terms: '',
    });
  });
  it('defaults the issue date and tolerates an empty project', () => {
    const f = buildProposalFields({}, { lines: null }, [], {
      reference: 'R',
      currency: 'EUR',
      clientName: '',
    });
    expect(f.issued_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(f.show).toEqual({
      title: '',
      gallery: '',
      artists: '',
      dates: '',
      venue: '',
      project: '',
    });
    expect(f.lines).toEqual([]);
    expect(f.total).toBe(0);
  });
});
