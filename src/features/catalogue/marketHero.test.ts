/**
 * `marketHero` — the Market hero's owner copy from `/api/app-theme/`, with the
 * old app's rules (THEME_DEFAULT fallback, a blank key hides its line).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { __resetOwnerSettings, applyOwnerSettings } from '../shell/ownerSettings';
import { marketHero } from './marketHero';

describe('marketHero', () => {
  afterEach(() => __resetOwnerSettings());

  it('falls back to THEME_DEFAULT when the theme has no hero keys', () => {
    expect(marketHero()).toEqual({
      show: true,
      eyebrow: 'Curated Collection',
      title: 'The Collection',
      intro: 'Contemporary Iranian works, available through darzmarket.art.',
    });
  });

  it('reads the owner copy, and a blank key hides that line', () => {
    applyOwnerSettings({ heroEyebrow: 'Spring', heroTitle: 'New Works', heroIntro: '' });
    expect(marketHero()).toMatchObject({ eyebrow: 'Spring', title: 'New Works', intro: '' });
  });

  it('hides the whole block only on showHero: false', () => {
    applyOwnerSettings({ showHero: false });
    expect(marketHero().show).toBe(false);
    applyOwnerSettings({ showHero: 'no' });
    expect(marketHero().show).toBe(true);
  });
});
