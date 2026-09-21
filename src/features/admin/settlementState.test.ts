/** What the settlement editor will and will not let you save. The point of
 * each case is that the server would refuse it — so refusing it here, in
 * readable words, is the whole job. */
import { describe, expect, it } from 'vitest';
import { parseState, pretty, sizeOf } from './settlementState';

describe('parseState', () => {
  it('accepts a JSON object and hands back the parsed value', () => {
    expect(parseState('{"claim":"120"}')).toEqual({ ok: true, value: { claim: '120' } });
  });

  it('accepts an empty object — a worksheet that has been started and not filled in', () => {
    expect(parseState('{}')).toEqual({ ok: true, value: {} });
  });

  it('refuses blank text rather than sending nothing', () => {
    expect(parseState('').ok).toBe(false);
    expect(parseState('   \n ').ok).toBe(false);
  });

  it('refuses an array, a bare value and null — the serializer requires an object', () => {
    for (const text of ['[1,2]', '"hello"', '42', 'true', 'null']) {
      const r = parseState(text);
      expect(r.ok, text).toBe(false);
      if (!r.ok) expect(r.error).toContain('JSON object');
    }
  });

  it('reports the parser’s own message on malformed JSON, not a generic one', () => {
    const r = parseState('{oops}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });
});

describe('pretty', () => {
  it('formats with two-space indentation so the blob is readable', () => {
    expect(pretty({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it('shows a never-saved worksheet as an empty object, not "null"', () => {
    expect(pretty(null)).toBe('{}');
    expect(pretty(undefined)).toBe('{}');
  });
});

describe('sizeOf', () => {
  it('counts top-level keys, singular and plural', () => {
    expect(sizeOf({ a: 1 })).toBe('1 top-level key');
    expect(sizeOf({ a: 1, b: 2 })).toBe('2 top-level keys');
    expect(sizeOf({})).toBe('0 top-level keys');
  });

  it('degrades for anything that is not an object', () => {
    expect(sizeOf(null)).toBe('—');
    expect(sizeOf([1, 2])).toBe('—');
    expect(sizeOf('x')).toBe('—');
  });
});
