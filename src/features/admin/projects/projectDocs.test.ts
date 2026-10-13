/**
 * The project Proposal + Invoice builder's pure half (`projectDocs.ts`): the
 * old composer's defaults, its pricing switch and notes, and the `fields`
 * payload the backend stores verbatim.
 */
import { describe, expect, it } from 'vitest';
import {
  buildProjectDocFields,
  composerFrom,
  docStatusWord,
  packageSummary,
  preparedFor,
  pricingNote,
  showsPricing,
  type ComposerDraft,
} from './projectDocs';
import { SERIES_KINDS } from '../exhibitionForm';

const CATALOG = [
  { id: 's-photo', name: 'Photo coverage', category: 'production', price: '700' },
  { id: 's-post', name: 'Instagram post', category: 'media', price: '100' },
] as never[];

const PKG = {
  name: 'Opening coverage',
  lines: [
    { svcId: 's-photo', count: 3 },
    { svcId: 's-post', count: 1 },
  ],
  counts: { posts: 4, stories: 2, videoMin: 3 },
  onsite: true,
  addons: [
    { name: 'Drone', price: 300, currency: 'T' },
    { name: 'Free extra', price: 0 },
  ],
  payment_stages: [
    { label: 'Deposit', pct: 50 },
    { label: '', pct: 50 },
  ],
  prod_timeline: '3 weeks',
  revisions: 1,
  usage_rights: '12 months',
  cancellation: '48h notice',
};

const PROJECT = {
  no: 'P-0007',
  name: 'Winter show',
  venue: 'Main hall',
  start_date: '2026-10-01',
  end_date: '2026-10-20',
  client_name: 'Gallery X',
  client_partner_org: null,
};

const draft = (patch: Partial<ComposerDraft> = {}): ComposerDraft => ({
  ...composerFrom('project_proposal', PROJECT as never, PKG as never, null, {
    reference: 'DARZ-PRO-2026-0003',
    currency: 'T',
  }),
  ...patch,
});

describe('composerFrom — the old init (:14033-14042)', () => {
  it('defaults the title to the package, the client and project to the record, pricing to Automatic', () => {
    const d = draft();
    expect(d).toMatchObject({
      kind: 'project_proposal',
      title: 'Opening coverage',
      client: 'Gallery X',
      projectName: 'Winter show',
      intro: '',
      notes: '',
      pricing: 'auto',
      reference: 'DARZ-PRO-2026-0003',
      currency: 'T',
    });
  });
  it('reopens a saved draft exactly as it was typed', () => {
    const d = composerFrom(
      'project_proposal',
      PROJECT as never,
      PKG as never,
      {
        title: 'For the winter',
        client: 'Someone',
        projectName: 'Show',
        intro: 'Hello',
        notes: 'N',
        pricing: 'off',
        reference: 'DARZ-PRO-2026-0001',
        currency: 'USD',
      },
      { reference: 'IGNORED', currency: 'T' },
    );
    expect(d).toMatchObject({
      title: 'For the winter',
      pricing: 'off',
      reference: 'DARZ-PRO-2026-0001',
      currency: 'USD',
    });
  });
  it('ignores a pricing value it does not know', () => {
    const d = composerFrom(
      'project_proposal',
      PROJECT as never,
      null,
      { pricing: 'maybe' },
      {
        reference: 'R',
        currency: 'T',
      },
    );
    expect(d.pricing).toBe('auto');
    expect(d.title).toBe('Proposal');
  });
});

describe('the pricing switch (:14060-14064, :14556-14557)', () => {
  it('words each mode verbatim', () => {
    expect(pricingNote('off', true)).toBe('The proposal will send without any pricing.');
    expect(pricingNote('auto', false)).toBe(
      'No price is entered on this package — the non-priced version is created automatically.',
    );
    expect(pricingNote('on', true)).toBe('The investment and payment schedule will be shown.');
    expect(pricingNote('auto', true)).toBe(
      'Pricing shows automatically because a price is set.',
    );
  });
  it('"With pricing" cannot force money that is not there, and never for a standard admin', () => {
    expect(showsPricing('on', true, false)).toBe(false);
    expect(showsPricing('on', false, true)).toBe(false);
    expect(showsPricing('auto', true, true)).toBe(true);
    expect(showsPricing('off', true, true)).toBe(false);
  });
  it('the package summary (:14058)', () => {
    expect(packageSummary(PKG as never, CATALOG, true, 'T')).toBe(
      '2 service lines · 6 deliverables · investment 2,200 T.',
    );
    expect(packageSummary(PKG as never, CATALOG, false, 'T')).toBe(
      '2 service lines · 6 deliverables · no price entered.',
    );
  });
});

describe('preparedFor (:14559-14560)', () => {
  it('names the project only when it differs from the client', () => {
    expect(preparedFor('Gallery X', 'Winter show')).toBe(
      'Prepared for Gallery X · Winter show',
    );
    expect(preparedFor('Same', 'Same')).toBe('Prepared for Same');
    expect(preparedFor('', '')).toBe('');
  });
});

describe('buildProjectDocFields — the proposal', () => {
  it('stores the composer inputs AND the priced snapshot when money may print', () => {
    const f = buildProjectDocFields(
      PROJECT,
      PKG as never,
      CATALOG,
      draft({ intro: 'A\n\nB' }),
      {
        money: true,
        issuedAt: '2026-10-13',
      },
    );
    expect(f).toMatchObject({
      // the old `_propSave` payload
      title: 'Opening coverage',
      client: 'Gallery X',
      projectName: 'Winter show',
      intro: 'A\n\nB',
      notes: '',
      pricing: 'auto',
      // the snapshot
      reference: 'DARZ-PRO-2026-0003',
      doc_label: 'Project proposal',
      prepared_for: 'Prepared for Gallery X · Winter show',
      issued_at: '2026-10-13',
      total: 2200,
      terms_label: 'Notes & terms',
    });
    expect(f.show?.title).toBe('Opening coverage');
    expect(f.lines?.map((l) => l.price)).toEqual(['2,100', '100']);
    expect(f.sections).toEqual([
      {
        label: 'Deliverables',
        rows: [
          ['Social posts', '4'],
          ['Stories', '2'],
          ['Video runtime', '3 min'],
          ['On-site production', 'Included'],
        ],
      },
      {
        label: 'Timeline',
        rows: [
          ['Production', '3 weeks'],
          ['Revisions', '1 round'],
        ],
      },
    ]);
    expect(f.schedule).toEqual([
      { label: 'Deposit · 50%', amount: 1100 },
      { label: 'Stage · 50%', amount: 1100 },
    ]);
    expect(f.addons).toEqual([{ name: 'Drone', price: 300, currency: 'T' }]);
    expect(f.terms_rows).toEqual([
      ['Usage rights', '12 months'],
      ['Cancellation', '48h notice'],
    ]);
  });
  it('"Without pricing" — the calm non-priced version: no prices, totals, schedule or add-ons', () => {
    const f = buildProjectDocFields(
      PROJECT,
      PKG as never,
      CATALOG,
      draft({ pricing: 'off' }),
      {
        money: true,
      },
    );
    expect(f.lines?.every((l) => l.price === '')).toBe(true);
    expect(f.total).toBeUndefined();
    expect(f.schedule).toBeUndefined();
    expect(f.addons).toBeUndefined();
    expect(f.pricing).toBe('off');
  });
  it('a document that may not carry money (standard admin, or a currency mismatch) goes out non-priced', () => {
    const f = buildProjectDocFields(PROJECT, PKG as never, CATALOG, draft(), { money: false });
    expect(f.total).toBeUndefined();
    expect(f.lines?.length).toBe(2);
  });
});

describe('buildProjectDocFields — the invoice (no old counterpart; the exhibition invoice shape)', () => {
  it('bills the client with the priced lines, the payment note, terms and the bank block', () => {
    const d = composerFrom('project_invoice', PROJECT as never, PKG as never, null, {
      reference: 'DARZ-SINV-2026-0002',
      currency: 'T',
      bank: { holder: 'Darz', bank: 'B', card: '1234', iban: 'IR00' },
    });
    const f = buildProjectDocFields(
      PROJECT,
      PKG as never,
      CATALOG,
      { ...d, note: 'Pay within 7 days', terms: '50/50' },
      { money: true },
    );
    expect(f).toMatchObject({
      reference: 'DARZ-SINV-2026-0002',
      doc_label: 'Services invoice',
      lines_label: 'Project services',
      billed_to: 'Gallery X',
      note: 'Pay within 7 days',
      terms: '50/50',
      total: 2200,
      bank: { holder: 'Darz', bank: 'B', card: '1234', iban: 'IR00' },
      pricing: 'on',
    });
    expect(f.show?.title).toBe('Winter show');
    expect(f.intro).toBe('');
  });
});

describe('the reference series and the status words', () => {
  it('project documents share PRO / SINV with the exhibition documents (one number, never reused)', () => {
    expect(SERIES_KINDS.PRO).toEqual(['exhibition_proposal', 'project_proposal', 'proposal']);
    expect(SERIES_KINDS.SINV).toEqual(['exhibition_invoice', 'project_invoice']);
  });
  it('Draft / Final (:14065), then the signature', () => {
    expect(docStatusWord({ status: 'draft' })).toBe('Draft');
    expect(docStatusWord({ status: 'confirmed', signed_at: null })).toBe('Final');
    expect(docStatusWord({ status: 'confirmed', signed_at: '2026-10-13T00:00:00Z' })).toBe(
      'Final · signed by Darz',
    );
  });
});
