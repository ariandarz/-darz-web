import { describe, expect, it } from 'vitest';
import type { DocumentAdmin, ExhibitionAdmin } from '../../../api/types';
import {
  blankLine,
  buildIssueFields,
  group,
  issueTotals,
  lineAmount,
  num,
  qtyOf,
  referenceFrom,
  slugKey,
  toWireLines,
  whyNotReady,
  type IssueLine,
} from './issueForm';

const line = (over: Partial<IssueLine> = {}): IssueLine => ({ ...blankLine(), ...over });

const SHOW: Pick<ExhibitionAdmin, 'title' | 'artists' | 'event_date' | 'venue' | 'project'> = {
  title: 'Soft Ground',
  artists: 'A. Artist',
  event_date: 'Oct 2026',
  venue: 'Night Gallery',
  project: '',
};

const doc = (reference: string): DocumentAdmin =>
  ({ id: reference, fields: { reference } }) as unknown as DocumentAdmin;

describe('num', () => {
  it('reads a typed amount however it is separated', () => {
    expect(num('1,200,000')).toBe(1200000);
    expect(num('1 200 000')).toBe(1200000);
    expect(num('700000')).toBe(700000);
    expect(num(700000)).toBe(700000);
  });

  it('treats nothing, rubbish and blanks as zero rather than NaN', () => {
    for (const v of ['', '   ', 'abc', null, undefined, NaN]) expect(num(v)).toBe(0);
  });
});

describe('group', () => {
  it('separates thousands without rounding', () => {
    expect(group(700000)).toBe('700,000');
    expect(group(1234)).toBe('1,234');
    expect(group(999)).toBe('999');
    expect(group(1234.5)).toBe('1,234.5');
  });
});

describe('quantity', () => {
  it('is at least one — a line is one of something', () => {
    expect(qtyOf(line({ qty: '' }))).toBe(1);
    expect(qtyOf(line({ qty: '0' }))).toBe(1);
    expect(qtyOf(line({ qty: '-4' }))).toBe(1);
    expect(qtyOf(line({ qty: 'abc' }))).toBe(1);
  });

  it('is whole units', () => {
    expect(qtyOf(line({ qty: '3' }))).toBe(3);
    expect(qtyOf(line({ qty: '2.9' }))).toBe(2);
  });

  it('multiplies the unit price into the line amount', () => {
    expect(lineAmount(line({ qty: '3', unitPrice: '700,000' }))).toBe(2100000);
    expect(lineAmount(line({ qty: '1', unitPrice: '700000' }))).toBe(700000);
  });

  it('leaves an unpriced line at zero instead of guessing', () => {
    expect(lineAmount(line({ qty: '5', unitPrice: '' }))).toBe(0);
  });
});

describe('issueTotals', () => {
  const lines = [
    line({ title: 'Photo', qty: '1', unitPrice: '700000' }),
    line({ title: 'Video', qty: '2', unitPrice: '10000000' }),
  ];

  it('sums the line amounts, not the unit prices', () => {
    expect(issueTotals(lines, '').subtotal).toBe(20700000);
  });

  it('takes the discount off the subtotal', () => {
    const t = issueTotals(lines, '700000');
    expect(t.discount).toBe(700000);
    expect(t.total).toBe(20000000);
  });

  it('never lets a discount push the total below zero', () => {
    const t = issueTotals(lines, '99999999999');
    expect(t.discount).toBe(20700000);
    expect(t.total).toBe(0);
  });

  it('ignores a negative discount rather than adding it on', () => {
    expect(issueTotals(lines, '-500').discount).toBe(0);
  });

  it('counts the lines with no price so the desk can say so', () => {
    expect(issueTotals([...lines, line({ title: 'Listing' })], '').unpriced).toBe(1);
    expect(issueTotals(lines, '').unpriced).toBe(0);
  });
});

describe('toWireLines', () => {
  it('sends the line AMOUNT as price — what the portal and the totals read', () => {
    const [wire] = toWireLines(
      [line({ title: 'Photo', qty: '3', unitPrice: '700000' })],
      'TMN',
    );
    expect(wire.price).toBe('2100000');
    expect(wire.currency).toBe('TMN');
    expect(wire.position).toBe(0);
  });

  it('sends null for an unpriced line, never 0 — 0 would read as free', () => {
    expect(toWireLines([line({ title: 'Listing' })], 'TMN')[0].price).toBeNull();
  });

  it('keeps a catalogue key, and makes one for a line typed by hand', () => {
    expect(
      toWireLines([line({ key: 'exhibition_photo', title: 'x' })], 'TMN')[0].service_key,
    ).toBe('exhibition_photo');
    expect(toWireLines([line({ title: 'A Custom Thing' })], 'TMN')[0].service_key).toBe(
      'a_custom_thing',
    );
  });

  it('numbers the lines in the order they are on screen', () => {
    const wire = toWireLines([line({ title: 'a' }), line({ title: 'b' })], 'TMN');
    expect(wire.map((w) => w.position)).toEqual([0, 1]);
  });
});

describe('slugKey', () => {
  it('stays within the backend field', () => {
    expect(slugKey('x'.repeat(200)).length).toBe(60);
  });
});

describe('buildIssueFields', () => {
  const draft = {
    kind: 'exhibition_proposal' as const,
    reference: 'DARZ-PRO-2026-0001',
    lines: [
      line({ title: 'Photo', description: 'the hung show', qty: '3', unitPrice: '700000' }),
    ],
    currency: 'TMN',
    discount: '100000',
    note: 'A note',
    terms: '50% on signing',
    issuedAt: '2026-09-19',
  };

  it('prints the amount, and explains it with qty and unit price', () => {
    const f = buildIssueFields(SHOW, 'Night Gallery', draft);
    expect(f.lines?.[0]).toMatchObject({
      title: 'Photo',
      description: 'the hung show',
      price: '2,100,000',
      qty: 3,
      unit_price: '700,000',
      currency: 'TMN',
    });
  });

  it('carries the show and the totals the preview and the PDF both read', () => {
    const f = buildIssueFields(SHOW, 'Night Gallery', draft);
    expect(f.show).toMatchObject({ title: 'Soft Ground', gallery: 'Night Gallery' });
    expect(f.subtotal).toBe(2100000);
    expect(f.discount).toBe(100000);
    expect(f.total).toBe(2000000);
    expect(f.terms).toBe('50% on signing');
    expect(f.reference).toBe('DARZ-PRO-2026-0001');
    expect(f.issued_at).toBe('2026-09-19');
  });

  it('gives a proposal no billing block', () => {
    const f = buildIssueFields(SHOW, 'Night Gallery', draft);
    expect(f.billed_to).toBeUndefined();
    expect(f.bank).toBeUndefined();
  });

  it('gives an invoice the counterparty and the bank block when it is filled', () => {
    const f = buildIssueFields(SHOW, 'Night Gallery', {
      ...draft,
      kind: 'exhibition_invoice',
      bank: { holder: 'Darz', bank: 'Bank', card: '', iban: 'IR..' },
    });
    expect(f.billed_to).toBe('Night Gallery');
    expect(f.bank).toMatchObject({ holder: 'Darz', iban: 'IR..' });
  });

  it('leaves the bank block off an invoice whose fields are all blank', () => {
    const f = buildIssueFields(SHOW, 'Night Gallery', {
      ...draft,
      kind: 'exhibition_invoice',
      bank: { holder: '', bank: '', card: '', iban: '' },
    });
    expect(f.bank).toBeUndefined();
  });

  it('prints an unpriced line with an empty price, not a zero', () => {
    const f = buildIssueFields(SHOW, 'Night Gallery', {
      ...draft,
      lines: [line({ title: 'Darz Listing' })],
    });
    expect(f.lines?.[0].price).toBe('');
    expect(f.lines?.[0].unit_price).toBe('');
  });
});

describe('referenceFrom', () => {
  it('takes the next number after the highest already issued in the series', () => {
    const refs = [doc('DARZ-PRO-2026-0003'), doc('DARZ-PRO-2026-0001')];
    expect(referenceFrom(refs, 'exhibition_proposal', 2026)).toBe('DARZ-PRO-2026-0004');
  });

  it('starts a series that has nothing in it yet', () => {
    expect(referenceFrom([], 'exhibition_invoice', 2026)).toBe('DARZ-SINV-2026-0001');
  });
});

describe('whyNotReady', () => {
  const ok = { reference: 'DARZ-PRO-2026-0001', lines: [line({ title: 'Photo' })] };

  it('is silent when the document can go out', () => {
    expect(whyNotReady('ev-1', ok)).toBeNull();
  });

  it('names the first thing missing, in the order the page reads', () => {
    expect(whyNotReady('', ok)).toMatch(/exhibition/i);
    expect(whyNotReady('ev-1', { ...ok, lines: [] })).toMatch(/at least one service/i);
    expect(whyNotReady('ev-1', { ...ok, lines: [line({ title: '  ' })] })).toMatch(
      /needs a name/i,
    );
    expect(whyNotReady('ev-1', { ...ok, reference: '' })).toMatch(/reference/i);
  });
});
