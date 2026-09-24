/**
 * The multilingual engine, and above all the guarantee that it is OFF.
 *
 * The old app ships English-only (`showLangSetting: 'Hidden'`, `i18n: {}`,
 * and its own comment "the app is English-only for now" at app.html:9944).
 * This port reproduces that default exactly, so the first block below is the
 * one that matters most: with no theme, nothing about the app changes.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nController } from './I18nController';
import { LANGUAGES } from './languages';
import { DICT } from './dictionary';
import { __resetOwnerSettings, applyOwnerSettings } from '../features/shell/ownerSettings';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
}
globalThis.localStorage = new MemoryStorage();

beforeEach(() => {
  localStorage.clear();
  __resetOwnerSettings();
});

describe('off by default — the guarantee', () => {
  it('is English alone when the owner has published no theme', () => {
    const c = new I18nController();
    c.start();
    const s = c.getSnapshot();
    expect(s.lang).toBe('en');
    expect(s.dir).toBe('ltr');
    expect(s.available.map((l) => l.code)).toEqual(['en']);
  });

  it('returns every string unchanged in English', () => {
    const c = new I18nController();
    c.start();
    // Including strings that ARE in the dictionary — English is the master
    // source, so there is nothing to substitute.
    expect(c.t('Market')).toBe('Market');
    expect(c.t('Auctions')).toBe('Auctions');
    expect(c.t('anything at all')).toBe('anything at all');
  });

  it('ignores ?lang= for a language the owner has not enabled', () => {
    // A stale link must not strand someone in a language that was withdrawn.
    const c = new I18nController();
    c.start('?lang=fa');
    expect(c.getSnapshot().lang).toBe('en');
  });

  it('ignores a stored language that is no longer enabled', () => {
    localStorage.setItem('darz_lang', 'ar');
    const c = new I18nController();
    c.start();
    expect(c.getSnapshot().lang).toBe('en');
  });
});

describe('what the owner enables', () => {
  beforeEach(() => applyOwnerSettings({ langs: { enabled: ['en', 'fa', 'fr'], def: 'fa' } }));

  it('offers exactly the enabled set, in display order', () => {
    const c = new I18nController();
    c.start();
    expect(c.getSnapshot().available.map((l) => l.code)).toEqual(['en', 'fa', 'fr']);
  });

  it('honours the theme default', () => {
    const c = new I18nController();
    c.start();
    expect(c.getSnapshot().lang).toBe('fa');
    expect(c.getSnapshot().dir).toBe('rtl');
  });

  it('lets ?lang= win over the default', () => {
    const c = new I18nController();
    c.start('?lang=fr');
    expect(c.getSnapshot().lang).toBe('fr');
  });

  it('lets the device choice win over the default, but not over ?lang=', () => {
    localStorage.setItem('darz_lang', 'fr');
    const a = new I18nController();
    a.start();
    expect(a.getSnapshot().lang).toBe('fr');

    const b = new I18nController();
    b.start('?lang=fa');
    expect(b.getSnapshot().lang).toBe('fa');
  });

  it('always keeps English available even if the owner omits it', () => {
    applyOwnerSettings({ langs: { enabled: ['fa'] } });
    const c = new I18nController();
    c.start();
    expect(c.getSnapshot().available.map((l) => l.code)).toContain('en');
  });

  it('translates from the shipped dictionary', () => {
    const c = new I18nController();
    c.start();
    expect(c.t('Market')).toBe(DICT['Market'].fa);
    expect(c.t('Artists')).toBe(DICT['Artists'].fa);
  });

  it('falls back to English for a string the dictionary lacks', () => {
    // Why an incomplete dictionary is safe to ship: a miss shows English, not
    // a key. Artist names and titles pass through for the same reason.
    const c = new I18nController();
    c.start();
    expect(c.t('Mahmoud Farshchian')).toBe('Mahmoud Farshchian');
    expect(c.t('$12,000')).toBe('$12,000');
  });

  it('lets a theme override beat the shipped translation', () => {
    applyOwnerSettings({
      langs: { enabled: ['en', 'fa'], def: 'fa' },
      i18n: { fa: { Market: 'بازار دارز' } },
    });
    const c = new I18nController();
    c.start();
    expect(c.t('Market')).toBe('بازار دارز');
    // A string the owner did not override still comes from the dictionary.
    expect(c.t('Artists')).toBe(DICT['Artists'].fa);
  });
});

describe('a theme someone hand-edited', () => {
  it('survives every wrong shape without throwing', () => {
    for (const langs of [
      null,
      'en',
      [],
      { enabled: 'fa' },
      { enabled: [1, 2] },
      { def: 'zz' },
    ]) {
      applyOwnerSettings({ langs });
      const c = new I18nController();
      expect(() => c.start()).not.toThrow();
      expect(c.getSnapshot().available.map((l) => l.code)).toContain('en');
    }
  });

  it('ignores unknown language codes in `enabled`', () => {
    applyOwnerSettings({ langs: { enabled: ['en', 'klingon', 'fa'] } });
    const c = new I18nController();
    c.start();
    expect(c.getSnapshot().available.map((l) => l.code)).toEqual(['en', 'fa']);
  });

  it('ignores a non-object i18n override map', () => {
    applyOwnerSettings({ langs: { enabled: ['en', 'fa'], def: 'fa' }, i18n: { fa: 'nope' } });
    const c = new I18nController();
    c.start();
    expect(c.t('Market')).toBe(DICT['Market'].fa);
  });
});

describe('the dictionary itself', () => {
  it('carries the old engine’s full set', () => {
    // 144 entries in `darz_i18n.js`. A drop here means the port lost strings.
    expect(Object.keys(DICT)).toHaveLength(144);
  });

  it('gives every entry all four non-master languages', () => {
    const incomplete = Object.entries(DICT).filter(([, v]) => !(v.fa && v.fr && v.es && v.ar));
    expect(incomplete.map(([k]) => k)).toEqual([]);
  });

  it('registers the five languages with the right direction', () => {
    expect(Object.keys(LANGUAGES)).toEqual(['en', 'fa', 'fr', 'es', 'ar']);
    expect(LANGUAGES.fa.dir).toBe('rtl');
    expect(LANGUAGES.ar.dir).toBe('rtl');
    expect(LANGUAGES.fr.dir).toBe('ltr');
  });
});
