/**
 * The tier pricing and the WhatsApp link.
 *
 * The prices are the only arithmetic on this screen and the one thing a
 * collector could be quoted wrongly, so both terms of both tiers are pinned
 * here against the old app's own figures.
 */
import { describe, expect, it } from 'vitest';
import { TIERS, termMonths, tierPrice, whatsappLink } from './tiers';

const basic = TIERS[0];
const premium = TIERS[1];

describe('tierPrice', () => {
  it('quotes one month at the listed rate', () => {
    expect(tierPrice(basic, '1')).toEqual({
      ir: '5,000,000 Toman / month',
      intl: '$10 / month',
      save: false,
    });
    expect(tierPrice(premium, '1')).toEqual({
      ir: '9,000,000 Toman / month',
      intl: '$25 / month',
      save: false,
    });
  });

  it('applies the 10% six-month discount to both currencies', () => {
    // 5,000,000 × 6 × 0.9 = 27,000,000 · $10 × 6 × 0.9 = $54
    expect(tierPrice(basic, '6')).toEqual({
      ir: '27,000,000 Toman / 6 months',
      intl: '$54 / 6 months',
      save: true,
    });
    // 9,000,000 × 6 × 0.9 = 48,600,000 → rounded to a clean whole million
    // (:10235), so 49,000,000. $25 × 6 × 0.9 = $135, left exact.
    expect(tierPrice(premium, '6')).toEqual({
      ir: '49,000,000 Toman / 6 months',
      intl: '$135 / 6 months',
      save: true,
    });
  });

  it('treats any unexpected term as one month', () => {
    expect(termMonths('1')).toBe(1);
    expect(termMonths('6')).toBe(6);
  });
});

describe('whatsappLink', () => {
  it('builds a wa.me link carrying the plan, duration and name', () => {
    const link = whatsappLink('+44 7341 632913', 'Premium Access', '6', 'Ada');
    expect(link).toMatch(/^https:\/\/wa\.me\/447341632913\?text=/);
    const text = decodeURIComponent(link!.split('text=')[1]);
    expect(text).toContain('Plan: Premium Access');
    expect(text).toContain('Duration: 6 months (10% discount)');
    expect(text).toContain('Name: Ada');
  });

  it('says one month for the short term', () => {
    const text = decodeURIComponent(
      whatsappLink('447341632913', 'Basic Access', '1', '')!.split('text=')[1],
    );
    expect(text).toContain('Duration: 1 month');
  });

  it('returns null when the owner has set no number', () => {
    // The sheet then shows the old app's own "Contact Darz to subscribe."
    // instead of linking to a number this repo invented (G-MEMB-5).
    expect(whatsappLink('', 'Basic Access', '1', 'Ada')).toBeNull();
    expect(whatsappLink('not a number', 'Basic Access', '1', 'Ada')).toBeNull();
  });
});
