import { describe, expect, it } from 'vitest';
import { WALK_MAX_PAGES, walkPages } from './paging';

function page(results: number[], has_next: boolean) {
  return {
    results,
    pagination: {
      page: 1,
      per_page: 100,
      total_pages: 1,
      total_count: 0,
      has_next,
      has_previous: false,
    },
  };
}

describe('walkPages', () => {
  it('follows has_next past the 100-row clamp (C-5)', async () => {
    const seen: number[] = [];
    const all = await walkPages((n) => {
      seen.push(n);
      return Promise.resolve(n === 1 ? page([1, 2], true) : page([3], false));
    });
    expect(all).toEqual([1, 2, 3]);
    expect(seen).toEqual([1, 2]);
  });

  it('stops on a missing pagination block', async () => {
    const all = await walkPages(() => Promise.resolve({ results: ['a'] }));
    expect(all).toEqual(['a']);
  });

  it('caps a has_next that never clears', async () => {
    let calls = 0;
    await walkPages(() => {
      calls += 1;
      return Promise.resolve(page([0], true));
    });
    expect(calls).toBe(WALK_MAX_PAGES);
  });
});
