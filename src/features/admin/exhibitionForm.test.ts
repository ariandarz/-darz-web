/** The desk half of the gallery loop — line math, the review diff, and the
 * doc-reference rule (`doc-reference.js` v1185: highest-seen + 1). */
import { describe, expect, it } from 'vitest';
import type { ExhibitionAdmin } from '../../api/types';
import {
  buildDocumentFields,
  describeUpdate,
  lineTotals,
  nextReference,
  seedLines,
  toLineInputs,
} from './exhibitionForm';

const CAT = [
  { key: 'photo', title: 'Photo Coverage', description: 'Views.', default_price: 700000 },
  { key: 'listing', title: 'Darz Listing', description: 'Private list.', default_price: null },
];

const EV: ExhibitionAdmin = {
  id: 'e1',
  link: 'l1',
  title: 'Winter Show',
  event_date: 'Feb 2027',
  venue: 'Main hall',
  artists: 'A. Artist',
  note: '',
  project: '',
  gallery_selected: ['photo', 'listing'],
  gallery_note: '',
  request_status: 'requested',
  currency: 'TMN',
  discount: '',
  admin_note: '',
  published: false,
  gallery_updated_at: null,
  admin_updated_at: null,
  created_by: null,
  service_lines: [],
  version: 1,
  created_at: '',
  updated_at: '',
};

describe('seedLines — the composer never opens empty on a request', () => {
  it('seeds from the ticks with catalogue prices; unknown keys survive', () => {
    const lines = seedLines({ ...EV, gallery_selected: ['photo', 'legacy_key'] }, CAT);
    expect(lines[0]).toMatchObject({
      service_key: 'photo',
      price: '700,000',
      status: 'proposed',
    });
    expect(lines[1]).toMatchObject({
      service_key: 'legacy_key',
      title: 'legacy_key',
      price: '',
    });
  });
  it('composed lines win over the ticks', () => {
    const ev = {
      ...EV,
      service_lines: [
        {
          id: 'x',
          service_key: 'photo',
          title: 'Photo',
          description: '',
          price: '900000.00',
          currency: 'TMN',
          status: 'confirmed' as const,
          admin_note: '',
          position: 0,
          created_at: '',
        },
      ],
    };
    expect(seedLines(ev, CAT)).toHaveLength(1);
    expect(seedLines(ev, CAT)[0]).toMatchObject({ price: '900,000.00', status: 'confirmed' });
  });
});

describe('lineTotals / toLineInputs', () => {
  const lines = seedLines(EV, CAT);
  it('declined lines drop; unpriced counted; discount subtracts', () => {
    const t = lineTotals(
      [...lines, { ...lines[0], status: 'declined' as const, price: '999,999' }],
      '100,000',
    );
    expect(t).toMatchObject({ sub: 700000, disc: 100000, tot: 600000, unpriced: 1 });
  });
  it('inputs clean separators and keep empty prices null', () => {
    const inputs = toLineInputs(lines);
    expect(inputs[0].price).toBe('700000');
    expect(inputs[1].price).toBeNull();
    expect(inputs[1].position).toBe(1);
  });
});

describe('describeUpdate — the queue reads words, not JSON', () => {
  it('an availability change reads was → now, with price and staff', () => {
    const rows = describeUpdate({
      kind: 'availability',
      payload: {
        fromStatus: 'available',
        availability_status: 'sold',
        chosenStatus: 'sold',
        price_amount: '9500000',
        currency: 'TMN',
        fromPrice: '12000.00',
        fromCurrency: 'USD',
        note: 'Sold via us.',
        staff: 'Sara',
      },
    });
    expect(rows).toEqual([
      { label: 'Availability', from: 'available', to: 'sold' },
      { label: 'Price', from: '12,000.00 USD', to: '9,500,000 TMN' },
      { label: 'Note', to: 'Sold via us.' },
      { label: 'Sent by', to: 'Sara' },
    ]);
  });
  it('a plain confirmation says so; a new work lists its facts', () => {
    expect(
      describeUpdate({ kind: 'availability', payload: { confirmAvailable: true } })[0],
    ).toEqual({
      label: 'Availability',
      to: 'confirmed still available',
    });
    const rows = describeUpdate({
      kind: 'new',
      payload: { artist: 'A', price: '12,000', currency: 'USD' },
    });
    expect(rows).toContainEqual({ label: 'Price', to: '12,000 USD' });
  });
});

describe('nextReference — highest seen + 1, per series per year', () => {
  it('scans stored references and ignores other series/years/legacy', () => {
    expect(
      nextReference(
        ['DARZ-PRO-2026-0007', 'DARZ-PRO-2025-0044', 'DARZ-SINV-2026-0100', 'DZA·0142', null],
        'PRO',
        2026,
      ),
    ).toBe('DARZ-PRO-2026-0008');
    expect(nextReference([], 'SINV', 2026)).toBe('DARZ-SINV-2026-0001');
  });
});

describe('buildDocumentFields — a self-contained snapshot', () => {
  it('proposal: declined lines excluded, totals baked in', () => {
    const lines = seedLines(EV, CAT);
    const f = buildDocumentFields('exhibition_proposal', EV, 'Night Gallery', lines, {
      reference: 'DARZ-PRO-2026-0001',
      note: 'Prices held.',
    });
    expect(f).toMatchObject({
      reference: 'DARZ-PRO-2026-0001',
      doc_label: 'Exhibition proposal',
      subtotal: 700000,
      total: 700000,
      currency: 'TMN',
    });
    expect((f.lines as unknown[]).length).toBe(2);
    expect(f).not.toHaveProperty('bank');
  });
  it('invoice: billed_to + bank ride along', () => {
    const f = buildDocumentFields(
      'exhibition_invoice',
      EV,
      'Night Gallery',
      seedLines(EV, CAT),
      {
        reference: 'DARZ-SINV-2026-0001',
        bank: { holder: 'A. E.', bank: 'Saman', card: '6219', iban: 'IR38' },
      },
    );
    expect(f.billed_to).toBe('Night Gallery');
    expect(f.bank).toMatchObject({ iban: 'IR38' });
  });
});
