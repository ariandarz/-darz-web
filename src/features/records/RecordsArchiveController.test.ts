import { describe, expect, it, vi } from 'vitest';
import type { AuctionRecord, Paginated } from '../../api/types';
import { RecordsArchiveController, sortRecords } from './RecordsArchiveController';

function page(results: AuctionRecord[], has_next = false): Paginated<AuctionRecord> {
  return {
    results,
    pagination: {
      page: 1,
      per_page: 100,
      total_pages: 1,
      total_count: results.length,
      has_next,
      has_previous: false,
    },
  };
}
const R = (
  id: string,
  house: string,
  artist: string | null,
  name: string,
  price: string | null,
  date: string,
) =>
  ({
    id,
    house,
    artist,
    artist_display_name: name,
    artist_name_raw: '',
    price_amount: price,
    currency: 'USD',
    sale_date: date,
    status: 'sold',
    section: 'past',
    image_url: '',
  }) as unknown as AuctionRecord;

describe('RecordsArchiveController', () => {
  it('walks every page, keeps only the five houses, and groups by artist', async () => {
    const records = vi
      .fn()
      .mockResolvedValueOnce(
        page(
          [
            R('1', "Sotheby's", 'a', 'Tanavoli', '100', '2020-01-01'),
            R('2', 'Phillips', 'a', 'Tanavoli', '999', '2021-01-01'),
          ],
          true,
        ),
      )
      .mockResolvedValueOnce(
        page([
          R('3', 'Tehran Auction', 'b', 'Monir', '50', '2019-01-01'),
          R('4', 'MILLON', null, 'Lashai', null, '2018-01-01'),
        ]),
      );
    const c = new RecordsArchiveController({ records } as never);
    await c.ensureLoaded();
    expect(records).toHaveBeenCalledTimes(2);
    expect(c.getSnapshot().records.map((r) => r.id)).toEqual(['1', '3', '4']); // Phillips dropped
    expect(c.artists().map((g) => [g.name, g.records.length])).toEqual([
      ['Lashai', 1],
      ['Monir', 1],
      ['Tanavoli', 1],
    ]);
    expect(c.forArtist('a').map((r) => r.id)).toEqual(['1']);
    expect(c.forArtist('name:Lashai')).toHaveLength(1);
    c.setSearch('tana');
    expect(c.artists().map((g) => g.name)).toEqual(['Tanavoli']);
    await c.ensureLoaded(); // already ready → no refetch
    expect(records).toHaveBeenCalledTimes(2);
  });

  it('sorts by date both ways and by result with unpriced lots last', () => {
    const list = [
      R('a', "Sotheby's", 'x', 'X', '300', '2019-01-01'),
      R('b', "Sotheby's", 'x', 'X', null, '2022-01-01'),
      R('c', "Sotheby's", 'x', 'X', '100', '2020-01-01'),
    ];
    expect(sortRecords(list, 'recent').map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(sortRecords(list, 'yearAsc').map((r) => r.id)).toEqual(['a', 'c', 'b']);
    expect(sortRecords(list, 'hi').map((r) => r.id)).toEqual(['a', 'c', 'b']);
    expect(sortRecords(list, 'lo').map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });
});
