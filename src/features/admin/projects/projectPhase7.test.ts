/** V1 Phase 7 — the Projects suite over the served API: the quick-filter
 * mapping (G-PROJ-1), the stage-move seeding of `stages` (G-PROJ-3, the old
 * `setStage` :13706-13714), the FX patch (G-PROJ-9) and the totals helpers
 * that render decimal strings without float maths (C-22). */
import { describe, expect, it } from 'vitest';
import { ProjectsAdminService } from '../../../api/services';
import type { Choice, ProjectTotals } from '../../../api/types';
import {
  QUICK,
  awaitsApproval,
  blankStageState,
  checklistFor,
  currencyLabel,
  decAdd,
  decIsZero,
  fmtDecimal,
  fmtRate,
  fxDraftFrom,
  fxPatch,
  isDelayed,
  moveStages,
  serverQuick,
  totalsRow,
  totalsRows,
} from './projectForm';

const STAGES: Choice[] = ['lead', 'qualification', 'brief', 'proposal', 'scopeApproval'].map(
  (value) => ({ value, label: value }),
);
const NOW = 1_790_000_000_000;

describe('serverQuick (G-PROJ-1)', () => {
  it('maps the four server-side cards and leaves deliverables to the client', () => {
    expect(QUICK.map(serverQuick)).toEqual([
      'active',
      'delayed',
      'awaiting_approval',
      null,
      'unpaid',
    ]);
  });
});

describe('ProjectsAdminService.projects — quick / partner on the wire', () => {
  function spy() {
    const sent: Array<{ path: string; query: unknown }> = [];
    const client = {
      send: (_m: string, path: string, opts?: { query?: unknown }) => {
        sent.push({ path, query: opts?.query });
        return Promise.resolve({});
      },
    };
    return { api: new ProjectsAdminService(client as never), sent };
  }

  it('sends quick and partner as given, archived as the Django boolean', async () => {
    const { api, sent } = spy();
    await api.projects({ quick: 'awaiting_approval', archived: false, per_page: 25 });
    await api.projects({ partner: 'org-1', archived: false, per_page: 1 });
    expect(sent[0]).toEqual({
      path: '/projects/admin/projects/',
      query: { quick: 'awaiting_approval', archived: 'False', per_page: 25 },
    });
    expect(sent[1].query).toEqual({ partner: 'org-1', archived: 'False', per_page: 1 });
  });

  it('reads totals from the per-project endpoint', async () => {
    const { api, sent } = spy();
    await api.totals('p1');
    expect(sent[0].path).toBe('/projects/admin/projects/p1/totals/');
  });
});

describe('moveStages (:13706-13714)', () => {
  it('seeds the target and every earlier stage from nothing', () => {
    const out = moveStages({}, STAGES, 'brief', null, '2026-09-25', NOW);
    expect(Object.keys(out).sort()).toEqual(['brief', 'lead', 'qualification']);
    expect(out.brief).toEqual({ ...blankStageState(), start: '2026-09-25' });
    expect(out.lead).toEqual({ ...blankStageState(), doneTs: NOW });
    expect(out.qualification).toMatchObject({ doneTs: NOW, start: '' });
  });

  it('keeps an existing start, stamp, checklist and unknown keys', () => {
    const raw = {
      lead: { doneTs: 5, owner: 'Sara', extra: 'kept' },
      brief: { start: '2026-01-01', checklist: [{ text: 'x' }], due: '2026-02-01' },
      proposal: { due: '2026-03-01' },
    };
    const out = moveStages(raw, STAGES, 'brief', ['a', 'b'], '2026-09-25', NOW);
    expect(out.lead).toEqual({ doneTs: 5, owner: 'Sara', extra: 'kept' });
    expect(out.brief).toEqual(raw.brief); // start and checklist untouched
    expect(out.proposal).toEqual({ due: '2026-03-01' }); // a later stage is not touched
    expect(raw.lead).toEqual({ doneTs: 5, owner: 'Sara', extra: 'kept' }); // input untouched
  });

  it('seeds an empty checklist from the template, one open row per item', () => {
    const out = moveStages({}, STAGES, 'proposal', ['Confirm scope', 'Draft'], 'd', NOW);
    const list = (out.proposal as { checklist: Array<Record<string, unknown>> }).checklist;
    expect(list.map((c) => c.text)).toEqual(['Confirm scope', 'Draft']);
    expect(list[0]).toMatchObject({ owner: '', due: '', done: false });
    expect(String(list[0].id)).toMatch(/^ci/);
  });

  it('writes the old blank’s approval flags, which the backend counts as awaiting', () => {
    const stages = moveStages(null, STAGES, 'qualification', null, '2026-09-25', NOW);
    // C-24: the old desk asked only a project IN a review stage; the backend asks every entry
    expect(awaitsApproval({ stages })).toBe(true);
    // the seeded entries carry no due date, so nothing is delayed by a move alone
    expect(isDelayed({ stages }, '2026-09-25')).toBe(false);
    expect(isDelayed({ stages: { lead: { due: '2026-09-01' } } }, '2026-09-25')).toBe(true);
  });

  it('treats a malformed record as empty and never throws', () => {
    expect(moveStages('nope', STAGES, 'lead', null, 'd', NOW)).toEqual({
      lead: { ...blankStageState(), start: 'd' },
    });
  });
});

describe('checklistFor (:13321)', () => {
  it('returns the first template of the stage as strings, or null', () => {
    const t = [
      { stage: 'proposal', items: ['A', { text: 'B' }, ''] },
      { stage: 'proposal', items: ['C'] },
    ];
    expect(checklistFor(t, 'proposal')).toEqual(['A', 'B']);
    expect(checklistFor(t, 'production')).toBeNull();
  });
});

describe('fxPatch (G-PROJ-9)', () => {
  it('shapes the four fields for the wire', () => {
    expect(
      fxPatch({
        deal_currency: 'USD',
        deal_fx_target_currency: ' tmn ',
        deal_fx_rate: '700,000',
        deal_fx_rate_date: '2026-09-25',
      }),
    ).toEqual({
      deal_currency: 'USD',
      deal_fx_target_currency: 'TMN',
      deal_fx_rate: '700000',
      deal_fx_rate_date: '2026-09-25',
    });
  });

  it('sends a cleared rate and date as null', () => {
    expect(fxPatch(fxDraftFrom({ deal_fx_rate: null, deal_fx_rate_date: null }))).toEqual({
      deal_currency: '',
      deal_fx_target_currency: '',
      deal_fx_rate: null,
      deal_fx_rate_date: null,
    });
  });

  it('reads the served record back into the draft', () => {
    expect(
      fxDraftFrom({
        deal_currency: 'USD',
        deal_fx_target_currency: 'TMN',
        deal_fx_rate: '700000.00000000',
        deal_fx_rate_date: '2026-09-25',
      }),
    ).toEqual({
      deal_currency: 'USD',
      deal_fx_target_currency: 'TMN',
      deal_fx_rate: '700000.00000000',
      deal_fx_rate_date: '2026-09-25',
    });
  });
});

describe('decimal strings (C-22)', () => {
  it('adds exactly, beyond float precision', () => {
    expect(decAdd('0.10', '0.20')).toBe('0.30');
    expect(decAdd('9007199254740993.01', '1.00')).toBe('9007199254740994.01');
    expect(decAdd('100.5', '-200.25')).toBe('-99.75');
    expect(decAdd('1,000', '5.00')).toBe('5.00'); // unparsable counts as 0, like the backend
  });

  it('knows a zero when it sees one', () => {
    expect(decIsZero('0.00')).toBe(true);
    expect(decIsZero('-0')).toBe(true);
    expect(decIsZero('0.01')).toBe(false);
  });

  it('groups without rounding and drops an all-zero fraction', () => {
    expect(fmtDecimal('1200.00', 'USD')).toBe('1,200 USD');
    expect(fmtDecimal('700000000.50')).toBe('700,000,000.50');
    expect(fmtDecimal('-1234.10', 'EUR')).toBe('-1,234.10 EUR');
    expect(fmtDecimal('-0.00')).toBe('0');
    expect(fmtDecimal('n/a', 'USD')).toBe('n/a USD');
  });

  it('shows the 8-dp rate as typed', () => {
    expect(fmtRate('700000.00000000')).toBe('700,000');
    expect(fmtRate('0.00125000')).toBe('0.00125');
  });
});

describe('totals rows', () => {
  const totals: ProjectTotals = {
    by_currency: {
      unknown: {
        internal: '0.00',
        external: '0.00',
        fee: '0.00',
        client: '50.00',
        paid: '0.00',
        due: '0.00',
      },
      USD: {
        internal: '100.10',
        external: '0.20',
        fee: '300.00',
        client: '1000.00',
        paid: '500.00',
        due: '500.00',
      },
    },
    fx: null,
  };

  it('puts the unknown bucket last, labelled, with an exact Cost', () => {
    const rows = totalsRows(totals);
    expect(rows.map((r) => r.cur)).toEqual(['USD', 'unknown']);
    expect(rows[0]).toMatchObject({ cost: '100.30', showPaid: true, label: 'USD' });
    expect(rows[1]).toMatchObject({ label: 'No currency', showPaid: false });
    expect(currencyLabel('unknown')).toBe('No currency');
  });

  it('reads a malformed response as no rows, a missing bucket as zeros', () => {
    expect(totalsRows(null)).toEqual([]);
    expect(totalsRows({ by_currency: 'x' as never })).toEqual([]);
    expect(totalsRow('TMN', null)).toMatchObject({ client: '0', cost: '0', showPaid: false });
  });
});
