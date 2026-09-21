/**
 * `asArray` is four lines, and it is tested because the cases it exists for
 * are the ones nobody pictures: the shapes that reached a `.map` in production
 * and blanked a desk. Each case below is one that really happened.
 */
import { describe, expect, it } from 'vitest';
import { asArray } from './shapes';

describe('asArray', () => {
  it('passes an array through, same contents and order', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    expect(asArray(rows)).toEqual(rows);
  });

  it('returns the array itself, not a copy — callers may compare identity', () => {
    const rows: unknown[] = [];
    expect(asArray(rows)).toBe(rows);
  });

  it('survives the paginated envelope an unmatched GET answers', () => {
    // The artwork editor's image store, which threw `images.map is not a
    // function` and took the whole editor with it.
    expect(asArray({ results: [], pagination: { page: 1 } })).toEqual([]);
  });

  it.each([null, undefined, 0, '', 'a string', {}, true])('survives %p', (raw) => {
    expect(asArray(raw)).toEqual([]);
  });

  it('does not treat an array-like object as an array', () => {
    // `{length: 2}` would pass a naive `.length` check and still throw on
    // `.map` — the exact shape of the bug this replaces.
    expect(asArray({ length: 2 })).toEqual([]);
  });

  it('does not treat a string as a list of characters', () => {
    expect(asArray('abc')).toEqual([]);
  });
});
