/**
 * `useT()` — the React seam over `I18nController`.
 *
 * Subscribes so a language switch re-renders, and returns the controller's own
 * bound `t`. Views call `t('Market')` with the ENGLISH string as the key, which
 * is what keeps the source readable and lets an untranslated string degrade to
 * itself (see `dictionary.ts`).
 */
import { useSyncExternalStore } from 'react';
import { i18n } from './I18nController';

export function useT(): (english: string) => string {
  useSyncExternalStore(
    (cb) => i18n.subscribe(cb),
    () => i18n.getSnapshot(),
    () => i18n.getSnapshot(),
  );
  return i18n.t;
}

/** The language state itself — for a picker, or anything that needs `dir`. */
export function useI18n() {
  return useSyncExternalStore(
    (cb) => i18n.subscribe(cb),
    () => i18n.getSnapshot(),
    () => i18n.getSnapshot(),
  );
}
