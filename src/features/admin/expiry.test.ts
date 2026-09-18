/** `expCell`'s rules (:33042) — the tone boundaries are the point. */
import { describe, expect, it } from 'vitest';
import { expiryParts } from './expiry';

const NOW = Date.parse('2026-09-18T12:00:00Z');
const days = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

describe('expiryParts', () => {
  it('a permanent key reads Never', () => {
    expect(expiryParts(null, NOW)).toEqual({ label: 'Never', tone: 'never' });
  });

  it('an unparseable date fails safe to Never rather than lying about a deadline', () => {
    expect(expiryParts('not-a-date', NOW).tone).toBe('never');
  });

  it('past and exactly-now are Expired (red)', () => {
    expect(expiryParts(days(-1), NOW)).toEqual({ label: 'Expired', tone: 'expired' });
    expect(expiryParts(new Date(NOW).toISOString(), NOW).tone).toBe('expired');
  });

  it('inside 24h reads "Expires today" (amber)', () => {
    expect(expiryParts(new Date(NOW + 3_600_000).toISOString(), NOW)).toEqual({
      label: 'Expires today',
      tone: 'soon',
    });
  });

  it('a week or less is amber, more is green — the :33042 boundary', () => {
    expect(expiryParts(days(7.5), NOW)).toEqual({ label: '7d left', tone: 'soon' });
    expect(expiryParts(days(8.5), NOW)).toEqual({ label: '8d left', tone: 'ok' });
  });
});
