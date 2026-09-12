/**
 * The insights arithmetic must be exact and evidence-gated: no figure appears
 * without enough data, nothing crosses currencies, unsold lots never count as
 * results, and the five-house filter tolerates apostrophe/case variants.
 */
import { describe, expect, it } from 'vitest';
import type { AuctionRecord } from '../../api/types';
import { artistInsights, houseLabel, isAllowedHouse, resultOf, V0_1_HOUSES } from './insights';

let n = 0;
function rec(over: Partial<AuctionRecord>): AuctionRecord {
  n += 1;
  return {
    id: `r${n}`,
    artist: 'a1',
    artist_display_name: 'Parviz Tanavoli',
    artist_name_raw: '',
    house: "Sotheby's",
    lot_title: `Lot ${n}`,
    sale_date: '2020-01-01',
    price_amount: '1000',
    currency: 'USD',
    lot_reference: '',
    source_url: '',
    notes: '',
    image_url: '',
    year: '',
    medium: '',
    dimensions: '',
    low_estimate: null,
    high_estimate: null,
    hammer_amount: null,
    realized_amount: null,
    sale_name: '',
    provenance: '',
    literature: '',
    exhibition: '',
    house_notes: '',
    previous_record: '',
    section: 'past',
    opens_at: null,
    closes_at: null,
    tz: '',
    status: 'sold',
    is_highlight: false,
    highlight_order: 0,
    version: 1,
    created_at: '',
    updated_at: '',
    ...over,
  } as AuctionRecord;
}

describe('the five v0.1 houses', () => {
  it('matches the houses case- and apostrophe-insensitively, and only those', () => {
    expect(V0_1_HOUSES).toHaveLength(5);
    for (const h of [
      "Sotheby's",
      'Sotheby’s',
      'SOTHEBYS',
      "christie's",
      'Bonhams',
      'Tehran Auction',
      'millon',
    ])
      expect(isAllowedHouse({ house: h })).toBe(true);
    for (const h of ['Phillips', 'Hindman', 'Darz', '', null])
      expect(isAllowedHouse({ house: h as string })).toBe(false);
    expect(houseLabel('SOTHEBYS')).toBe("Sotheby's");
    expect(houseLabel('Phillips')).toBe('Phillips');
  });
});

describe('artistInsights', () => {
  it('reports nothing statistical with too little data, and never invents a figure', () => {
    const one = artistInsights([rec({ price_amount: '5000' })]);
    expect(one.sales).toBe(1);
    expect(one.highest?.price_amount).toBe('5000');
    expect(one.lowest).toBeNull(); // one sale has no "lowest"
    expect(one.byYear).toEqual([]); // needs two years
    expect(one.vsEstimate).toBeNull();
    expect(one.aboveHighShare).toBeNull();
    expect(one.trend).toBeNull();
    expect(one.sellThrough).toBeNull();
    expect(artistInsights([]).highest).toBeNull();
  });

  it('counts only sold results with a price, excluding unsold and pending lots', () => {
    const i = artistInsights([
      rec({ price_amount: '3000' }),
      rec({ price_amount: null, status: 'unsold' }),
      rec({ price_amount: '9000', status: 'pending' }),
      rec({ price_amount: '2000', status: 'passed' }),
    ]);
    expect(i.records).toBe(4);
    expect(i.sales).toBe(1);
    expect(i.sellThrough).toBe(1 / 3); // sold ÷ (sold + unsold + passed), pending excluded
    expect(resultOf(rec({ price_amount: null, hammer_amount: '700' }))).toBe(700);
  });

  it('stays inside the dominant currency — never mixes or converts', () => {
    const i = artistInsights([
      rec({ price_amount: '100', currency: 'USD', sale_date: '2019-05-01' }),
      rec({ price_amount: '200', currency: 'USD', sale_date: '2021-05-01' }),
      rec({ price_amount: '9999999', currency: 'IRR', sale_date: '2022-05-01' }),
    ]);
    expect(i.currency).toBe('USD');
    expect(i.sales).toBe(2);
    expect(i.highest?.price_amount).toBe('200');
    expect(i.lowest?.price_amount).toBe('100');
  });

  it('computes the yearly series, estimate performance and the trend exactly', () => {
    const i = artistInsights([
      rec({
        price_amount: '100',
        sale_date: '2018-03-01',
        low_estimate: '80',
        high_estimate: '120',
      }),
      rec({
        price_amount: '120',
        sale_date: '2018-09-01',
        low_estimate: '80',
        high_estimate: '100',
      }),
      rec({
        price_amount: '200',
        sale_date: '2020-03-01',
        low_estimate: '100',
        high_estimate: '150',
      }),
      rec({ price_amount: '240', sale_date: '2021-03-01' }),
    ]);
    expect(i.byYear).toEqual([
      { year: 2018, sales: 2, high: 120, median: 110 },
      { year: 2020, sales: 1, high: 200, median: 200 },
      { year: 2021, sales: 1, high: 240, median: 240 },
    ]);
    // (100−100)/100 = 0, (120−90)/90 = 1/3, (200−125)/125 = 0.6 → mean 0.3111…
    expect(i.vsEstimate).toBeCloseTo((0 + 1 / 3 + 0.6) / 3, 10);
    expect(i.aboveHighShare).toBeCloseTo(2 / 3, 10); // 120>100, 200>150; 100 = 120? no → 2 of 3
    // oldest half avg (100+120)/2 = 110, newest half (200+240)/2 = 220 → ratio 2 → Rising
    expect(i.trend).toBe('Rising');
    expect(i.recent.map((r) => r.price_amount)).toEqual(['240', '200', '120']);
  });

  it('calls a flat series Stable and a falling one Declining', () => {
    const flat = artistInsights(
      ['2018', '2019', '2020', '2021'].map((y) =>
        rec({ price_amount: '100', sale_date: `${y}-01-01` }),
      ),
    );
    expect(flat.trend).toBe('Stable');
    const down = artistInsights(
      [
        ['2018', '300'],
        ['2019', '300'],
        ['2020', '100'],
        ['2021', '100'],
      ].map(([y, p]) => rec({ price_amount: p, sale_date: `${y}-01-01` })),
    );
    expect(down.trend).toBe('Declining');
  });
});
