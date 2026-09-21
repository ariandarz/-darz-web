import { describe, expect, it } from 'vitest';
import type { ServiceCatalogItemAdmin } from '../../api/types';
import {
  EXHIBITION_SERVICE_ROWS,
  asCatalogueEntries,
  priceExhibitionServices,
  priceListSummary,
} from './priceList';

/** A catalogue row, with only the fields the join reads. */
const row = (
  name: string,
  price: string | undefined,
  currency = 'TMN',
): ServiceCatalogItemAdmin =>
  ({
    id: `id-${name}`,
    name,
    price,
    currency,
    version: 1,
    created_at: '',
    updated_at: '',
  }) as unknown as ServiceCatalogItemAdmin;

describe('EXHIBITION_SERVICE_ROWS', () => {
  it('is the eight portal services, derived from the seed', () => {
    expect(EXHIBITION_SERVICE_ROWS).toHaveLength(8);
    expect(EXHIBITION_SERVICE_ROWS.map((r) => r.key)).toEqual([
      'exhibition_photo',
      'video_documentation',
      'preopening_teaser',
      'studio_visit',
      'cinematic_film',
      'artist_interview',
      'exhibition_review',
      'darz_listing',
    ]);
  });

  it('carries each service description, so a proposal line is not blank', () => {
    for (const r of EXHIBITION_SERVICE_ROWS) expect(r.about.length).toBeGreaterThan(20);
  });
});

describe('priceExhibitionServices', () => {
  it('prices a line from a catalogue row in the same currency', () => {
    const out = priceExhibitionServices([row('Exhibition Photo Coverage', '700000')], 'TMN');
    const photo = out.find((p) => p.key === 'exhibition_photo');
    expect(photo).toMatchObject({ price: 700000, origin: 'list', listCurrency: 'TMN' });
  });

  it('matches by name case-insensitively, the way the seed keys rows', () => {
    const out = priceExhibitionServices([row('exhibition photo coverage', '700000')], 'TMN');
    expect(out.find((p) => p.key === 'exhibition_photo')?.price).toBe(700000);
  });

  it('NEVER converts: another currency holds the price back', () => {
    const out = priceExhibitionServices([row('Artist Interview', '250', 'USD')], 'TMN');
    const ai = out.find((p) => p.key === 'artist_interview');
    expect(ai?.price).toBeNull();
    expect(ai?.origin).toBe('other-currency');
    // the figure the admin set is still reported, so the desk can show it
    expect(ai).toMatchObject({ listPrice: 250, listCurrency: 'USD' });
  });

  it('treats a missing, empty or zero price as not priced yet', () => {
    for (const p of [undefined, '', '0', '0.00']) {
      const out = priceExhibitionServices([row('Darz Listing', p)], 'TMN');
      const dl = out.find((p2) => p2.key === 'darz_listing');
      expect(dl?.price).toBeNull();
      expect(dl?.origin).toBe('unpriced');
    }
  });

  it('reports a service the catalogue does not carry as missing', () => {
    const out = priceExhibitionServices([], 'TMN');
    expect(out).toHaveLength(8);
    expect(out.every((p) => p.origin === 'missing' && p.price === null)).toBe(true);
  });

  it('always returns all eight, whatever the catalogue holds', () => {
    const out = priceExhibitionServices([row('Something Else', '5')], 'TMN');
    expect(out.map((p) => p.key)).toEqual(EXHIBITION_SERVICE_ROWS.map((r) => r.key));
  });

  it('lets the first row of a duplicated name win, never the later one', () => {
    const out = priceExhibitionServices(
      [row('Video Documentation', '10000000'), row('Video Documentation', '999')],
      'TMN',
    );
    expect(out.find((p) => p.key === 'video_documentation')?.price).toBe(10000000);
  });

  it('keeps the catalogue row name when it differs from the seed name', () => {
    const out = priceExhibitionServices([row('Exhibition photo coverage ', '1')], 'TMN');
    // (trailing space + lower case still joins; the row's own spelling shows)
    expect(out.find((p) => p.key === 'exhibition_photo')?.title).toBe(
      'Exhibition photo coverage ',
    );
  });
});

describe('asCatalogueEntries', () => {
  it('speaks the composer’s own shape, so seedLines needs no change', () => {
    const priced = priceExhibitionServices([row('Artist Interview', '8000000')], 'TMN');
    const entries = asCatalogueEntries(priced);
    expect(entries.find((e) => e.key === 'artist_interview')).toEqual({
      key: 'artist_interview',
      title: 'Artist Interview',
      description: expect.stringContaining('editorial interview'),
      default_price: 8000000,
    });
  });

  it('carries a held-back price as null, never as the un-converted number', () => {
    const priced = priceExhibitionServices([row('Artist Interview', '250', 'USD')], 'TMN');
    expect(
      asCatalogueEntries(priced).find((e) => e.key === 'artist_interview')?.default_price,
    ).toBeNull();
  });
});

describe('priceListSummary', () => {
  it('says nothing when there is nothing to say', () => {
    expect(priceListSummary([], 'TMN')).toBeNull();
  });

  it('names the currency clash and offers the way out', () => {
    const priced = priceExhibitionServices(
      EXHIBITION_SERVICE_ROWS.map((r) => row(r.name, '100', 'USD')),
      'TMN',
    );
    const text = priceListSummary(priced, 'TMN') ?? '';
    expect(text).toContain('USD');
    expect(text).toContain('TMN');
    expect(text).toMatch(/exchange rate/i);
  });

  it('points an empty catalogue at the one place to fix it', () => {
    const text = priceListSummary(priceExhibitionServices([], 'TMN'), 'TMN') ?? '';
    expect(text).toMatch(/service catalogue/i);
    expect(text).toMatch(/Packages/);
  });

  it('counts what carried over and what did not', () => {
    const priced = priceExhibitionServices(
      [
        row('Exhibition Photo Coverage', '700000'),
        row('Video Documentation', '10000000'),
        row('Darz Listing', ''),
        row('Artist Interview', '250', 'USD'),
      ],
      'TMN',
    );
    const text = priceListSummary(priced, 'TMN') ?? '';
    expect(text).toContain('2 of 8 priced');
    expect(text).toContain('1 held back');
    expect(text).toContain('1 not priced there yet');
    expect(text).toContain('4 not in it');
  });
});
