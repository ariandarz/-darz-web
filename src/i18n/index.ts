/** Multilingual support — the old app's engine, shipped OFF by default.
 * See `I18nController` for what "off" means and why. */
export { I18nController, i18n, type I18nSnapshot } from './I18nController';
export { LANGUAGES, LANGUAGE_ORDER, MASTER, isLanguage, type Language } from './languages';
export { DICT, type Dictionary } from './dictionary';
export { useI18n, useT } from './useT';
