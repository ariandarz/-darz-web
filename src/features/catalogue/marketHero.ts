/**
 * The Market hero's owner copy (V1 Phase 10). The old app read it from the
 * theme — `heroEyebrow` / `heroTitle` / `heroIntro` and the `showHero` switch
 * (THEME_DEFAULT, app.html:2845; rendered at :8679-8682) — and the new app
 * serves the same freeform theme on `GET /api/app-theme/`.
 *
 * Faithful to the old rules, which differ from `settingString`'s: a missing
 * key falls back to THEME_DEFAULT, but a key the owner saved BLANK hides that
 * line (the old `t.heroEyebrow ? … : ''`), and only `showHero: false` hides
 * the whole block. `heroCompact` is not ported (no `.hero.compact` rule here).
 */
import { settingUnknown } from '../shell/ownerSettings';

export interface MarketHero {
  show: boolean;
  eyebrow: string;
  title: string;
  intro: string;
}

const DEFAULTS = {
  heroEyebrow: 'Curated Collection',
  heroTitle: 'The Collection',
  heroIntro: 'Contemporary Iranian works, available through darzmarket.art.',
} as const;

function copy(key: keyof typeof DEFAULTS): string {
  const raw = settingUnknown(key);
  return typeof raw === 'string' ? raw.trim() : DEFAULTS[key];
}

export function marketHero(): MarketHero {
  return {
    show: settingUnknown('showHero') !== false,
    eyebrow: copy('heroEyebrow'),
    title: copy('heroTitle'),
    intro: copy('heroIntro'),
  };
}
