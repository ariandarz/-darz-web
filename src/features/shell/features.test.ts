/**
 * The v0.1 feature table — what is visible, what is preserved-but-hidden, and
 * that a hidden feature's deep links are refused.
 */
import { describe, expect, it } from 'vitest';
import { FEATURE_SETS, isHiddenPath, resolveFeatureSet } from './features';

describe('feature sets', () => {
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
