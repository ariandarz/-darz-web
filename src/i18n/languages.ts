/**
 * The language registry — `LANGS` / `ORDER` in
 * `../../DarzStudio/darz_i18n.js:38-47`, ported verbatim.
 *
 * Adding a language is one entry here plus its strings in `dictionary.ts`;
 * the old engine's own note says the same, and nothing else in this folder
 * needs to change.
 */

export interface Language {
  code: string;
  name: string;
  /** The language's own name, which is what a picker shows. */
  native: string;
  dir: 'ltr' | 'rtl';
  /** English is the master source — every other language falls back to it. */
  master?: boolean;
  /** Set only where the brand fonts have no coverage; see `applyDocument`. */
  font?: string;
}

/** Vazirmatn is already self-hosted for both scripts (`src/design/fonts.css`
 * imports its `arabic` subset), so an RTL language needs no extra download. */
const RTL_FONT = "'Vazirmatn', Tahoma, 'Segoe UI', system-ui, sans-serif";

export const LANGUAGES: Readonly<Record<string, Language>> = {
  en: { code: 'en', name: 'English', native: 'English', dir: 'ltr', master: true },
  fa: { code: 'fa', name: 'Persian', native: 'فارسی', dir: 'rtl', font: RTL_FONT },
  fr: { code: 'fr', name: 'French', native: 'Français', dir: 'ltr' },
  es: { code: 'es', name: 'Spanish', native: 'Español', dir: 'ltr' },
  ar: { code: 'ar', name: 'Arabic', native: 'العربية', dir: 'rtl', font: RTL_FONT },
};

/** Display order in the picker (`ORDER`, `:48`). */
export const LANGUAGE_ORDER = ['en', 'fa', 'fr', 'es', 'ar'] as const;

export const MASTER = 'en';

export function isLanguage(code: unknown): code is string {
  return typeof code === 'string' && code in LANGUAGES;
}
