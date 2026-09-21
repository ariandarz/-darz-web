/**
 * The v0.1 feature table — what is visible, what is preserved-but-hidden, and
 * that a hidden feature's deep links are refused.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FEATURE_SETS,
  isHiddenPath,
  resolveFeatureFlags,
  resolveFeatureSet,
} from './features';

describe('feature sets', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('v0.1 shows Market · Records · Chat · Profile · Settings and Send Inquiry only', () => {
    const f = FEATURE_SETS['v0.1'];
    expect([f.market, f.records, f.chat, f.profile, f.settings]).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(f.sendInquiry).toBe(true);
    expect(f.save).toBe(true);
    // preserved, hidden
    expect(f.commerceActions).toBe(false);
    expect(f.auctions).toBe(false);
    expect(f.profileAuctions).toBe(false);
    expect(f.questionnaire).toBe(false);
    expect(f.aiChat).toBe(false);
    expect(f.galleryChat).toBe(false);
    expect(f.stories).toBe(false);
  });

  it('the full set switches the preserved features back on without a rebuild', () => {
    const f = FEATURE_SETS.full;
    expect(f.auctions).toBe(true);
    expect(f.commerceActions).toBe(true);
    expect(f.sendInquiry).toBe(true);
  });

  it('defaults to v0.1 when the env var is unset or unknown', () => {
    expect(resolveFeatureSet(undefined)).toBe('v0.1');
    expect(resolveFeatureSet('')).toBe('v0.1');
    expect(resolveFeatureSet('beta')).toBe('v0.1');
    expect(resolveFeatureSet('full')).toBe('full');
  });

  it('ignores the ambient env — the raw value is the only input', () => {
    /* Regression guard. `resolveFeatureSet` used to default its parameter to
       `import.meta.env.VITE_FEATURE_SET`, and a JS default fires on an explicit
       `undefined`, so the "unset" assertion above silently re-read the
       environment. A developer whose .env.local says `full` got a red test; CI,
       with no .env.local, got green. Pin it: even with the env set to `full`,
       an unset raw value must still resolve to v0.1. */
    vi.stubEnv('VITE_FEATURE_SET', 'full');
    expect(resolveFeatureSet(undefined)).toBe('v0.1');
    expect(resolveFeatureSet('')).toBe('v0.1');
    expect(resolveFeatureSet('full')).toBe('full');
  });

  it('refuses deep links into a hidden feature, and only those', () => {
    const f = FEATURE_SETS['v0.1'];
    expect(isHiddenPath('/auctions', f)).toBe(true);
    expect(isHiddenPath('/auctions/lots/abc', f)).toBe(true);
    expect(isHiddenPath('/auctions/notifications', f)).toBe(true);
    expect(isHiddenPath('/records', f)).toBe(false);
    expect(isHiddenPath('/chat/abc', f)).toBe(false);
    expect(isHiddenPath('/auctionsx', f)).toBe(false); // prefix, not substring
    expect(isHiddenPath('/', f)).toBe(false);
  });
});

describe('resolveFeatureFlags — the owner’s runtime switches (theme.features)', () => {
  const base = FEATURE_SETS['v0.1'];

  it('applies known boolean switches over the build-time set', () => {
    const next = resolveFeatureFlags(base, { auctions: true, records: false });
    expect(next.auctions).toBe(true);
    expect(next.records).toBe(false);
    // untouched keys keep the build-time value
    expect(next.chat).toBe(base.chat);
  });

  it('ignores unknown keys — a typo in the stored JSON is not a feature', () => {
    const next = resolveFeatureFlags(base, { auctons: true });
    expect((next as unknown as Record<string, unknown>).auctons).toBeUndefined();
  });

  it('honours only literal booleans — "false" the string must not switch anything ON', () => {
    const next = resolveFeatureFlags(base, { records: 'false', chat: 0, save: null });
    expect(next.records).toBe(base.records);
    expect(next.chat).toBe(base.chat);
    expect(next.save).toBe(base.save);
  });

  it('never lets market be switched off — the catalogue is the app', () => {
    expect(resolveFeatureFlags(base, { market: false }).market).toBe(true);
  });

  it('applies nothing on a missing / malformed features object', () => {
    expect(resolveFeatureFlags(base, undefined)).toEqual({ ...base, market: true });
    expect(resolveFeatureFlags(base, 'nope')).toEqual({ ...base, market: true });
  });

  it('does not mutate its input', () => {
    const copy = { ...base };
    resolveFeatureFlags(base, { records: !base.records });
    expect(base).toEqual(copy);
  });
});
