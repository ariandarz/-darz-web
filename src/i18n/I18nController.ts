/**
 * I18nController — the app's active language, on the shared `Observable` base
 * every framework-free controller here extends.
 *
 * Port of `darz_i18n.js`'s **contract**, not its mechanism, and the difference
 * is deliberate. That engine translates by sweeping the DOM after every render
 * and swapping registered English strings — the only option in a
 * string-concatenation app. In React that approach fights the renderer: a
 * MutationObserver rewriting text React owns is undone on the next commit, and
 * the two take turns. So the same dictionary, the same theme keys and the same
 * defaults are kept, and the substitution moves to a `t()` lookup at the call
 * site. A mechanics change, not a content one.
 *
 * ## It is OFF unless the owner turns it on
 *
 * `theme.langs.enabled` defaults to `['en']` (`darz_i18n.js:224`), and the old
 * app ships `showLangSetting: 'Hidden'` with `i18n: {}` — its own comment at
 * `app.html:9944` reads *"the app is English-only for now"*. That default is
 * reproduced exactly: with no theme, `available()` is English alone, `t()`
 * returns its argument unchanged, and the document keeps `lang="en" dir="ltr"`.
 * **Nothing about the app changes until the owner publishes a `theme.langs`.**
 *
 * ## Resolution order
 *
 * `?lang=` (`urlLang`, `:244`) → the per-device choice → the theme's default →
 * English. A code that is not enabled is ignored at every step, so a stale
 * link or a disabled language can never strand someone in a language the owner
 * withdrew.
 */
import { Observable } from '../features/shared/Observable';
import { settingRecord } from '../features/shell/ownerSettings';
import { DICT, type Dictionary } from './dictionary';
import { LANGUAGES, LANGUAGE_ORDER, MASTER, isLanguage, type Language } from './languages';

const LS_LANG = 'darz_lang';

export interface I18nSnapshot {
  lang: string;
  dir: 'ltr' | 'rtl';
  /** Enabled languages in display order — one entry means no picker. */
  available: Language[];
}

/** `theme.i18n` — per-string owner overrides, `{lang: {english: translation}}`.
 * Narrowed defensively: the theme is hand-editable JSON. */
function overridesFor(lang: string): Record<string, string> {
  const raw = settingRecord('i18n')[lang];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && v !== '') out[k] = v;
  }
  return out;
}

export class I18nController extends Observable<I18nSnapshot> {
  private readonly dict: Dictionary;

  constructor(dict: Dictionary = DICT) {
    super({ lang: MASTER, dir: 'ltr', available: [LANGUAGES[MASTER]] });
    this.dict = dict;
  }

  /** `cfg()` (`:221`) — which languages the owner enabled, in display order.
   * English is always present, master or not. */
  private enabled(): string[] {
    const langs = settingRecord('langs');
    const raw = Array.isArray(langs.enabled) ? langs.enabled : [];
    const picked = raw.filter(isLanguage);
    const set = new Set(picked.length ? picked : [MASTER]);
    set.add(MASTER);
    return LANGUAGE_ORDER.filter((c) => set.has(c));
  }

  private defaultLang(available: string[]): string {
    const def = settingRecord('langs').def;
    return isLanguage(def) && available.includes(def) ? def : MASTER;
  }

  /**
   * Read the theme and settle on a language. Called once at boot, after
   * `applyOwnerSettings` — before it, the theme is empty and this correctly
   * resolves to English.
   */
  start(search = ''): void {
    const available = this.enabled();
    const fromUrl = /[?&]lang=([a-z]{2})/i.exec(search)?.[1]?.toLowerCase();
    const stored = this.readStored();
    const lang =
      (fromUrl && available.includes(fromUrl) && fromUrl) ||
      (stored && available.includes(stored) && stored) ||
      this.defaultLang(available);
    this.set(lang, available);
  }

  /** Switch language and remember it on this device. */
  set(lang: string, available = this.enabled()): void {
    const code = available.includes(lang) ? lang : MASTER;
    if (code !== MASTER || this.readStored()) this.writeStored(code);
    this.replace({
      lang: code,
      dir: LANGUAGES[code].dir,
      available: available.map((c) => LANGUAGES[c]),
    });
  }

  /**
   * Translate one English source string.
   *
   * Owner override wins over the shipped dictionary (`:234`); a miss returns
   * the English unchanged, so an incomplete dictionary degrades to English
   * rather than to a key. That is what makes it safe to enable a language
   * before its translations are finished.
   */
  t = (english: string): string => {
    const { lang } = this.getSnapshot();
    if (lang === MASTER) return english;
    return overridesFor(lang)[english] ?? this.dict[english]?.[lang] ?? english;
  };

  /**
   * Put the language on the document: `lang`, `dir`, and the script font where
   * the brand faces have no coverage (`:355`).
   *
   * **`dir` is all the RTL this ships, deliberately.** It gives correct text
   * direction, mirrored logical properties and native bidi — but the old
   * engine also injects a stylesheet of RTL overrides for its LTR-only layout,
   * and this app's CSS has not been audited for that. Until it is, enabling
   * Farsi or Arabic gives correct TEXT in a layout that may still read
   * left-to-right in places. Recorded as **G-I18N-1**; see the PR.
   */
  applyDocument(doc: Document = document): void {
    const { lang, dir } = this.getSnapshot();
    const html = doc.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', dir);
    const font = LANGUAGES[lang]?.font;
    if (font) html.style.setProperty('--font-body', font);
    else html.style.removeProperty('--font-body');
  }

  private readStored(): string | null {
    try {
      const v = localStorage.getItem(LS_LANG);
      return isLanguage(v) ? v : null;
    } catch {
      return null;
    }
  }

  private writeStored(lang: string): void {
    try {
      localStorage.setItem(LS_LANG, lang);
    } catch {
      /* private window — the language holds for this page load only */
    }
  }
}

/** The app's instance. One per document, like `ThemeController`. */
export const i18n = new I18nController();
