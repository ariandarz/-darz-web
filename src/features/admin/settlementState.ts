/**
 * The settlement worksheet's state handling — pure, so the rules that decide
 * whether a Save is even offered are testable (vitest, no jsdom).
 *
 * `SettlementWorksheet.state` is a freeform JSONField with no schema on either
 * side, but it is not unconstrained: `SettlementWorksheetSaveSerializer`
 * requires a JSON **object**. Catching an array or a bare value here, in the
 * same words the person is already reading, is better than sending it and
 * translating a 400.
 */

export type ParsedState =
  { ok: true; value: Record<string, unknown> } | { ok: false; error: string };

/** The stored state as editable text. A worksheet that has never been saved is
 * `{}` server-side, which formats to `{}` — an honest empty start. */
export function pretty(state: unknown): string {
  try {
    return JSON.stringify(state ?? {}, null, 2);
  } catch {
    // circular — cannot come off the wire, but the editor must not blank out
    return '{}';
  }
}

export function parseState(text: string): ParsedState {
  if (!text.trim())
    return { ok: false, error: 'Empty — the worksheet must be a JSON object.' };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'That is not valid JSON.',
    };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      error: 'The worksheet must be a JSON object, not an array or a value.',
    };
  }
  return { ok: true, value: value as Record<string, unknown> };
}

/** A version's one-line description. The snapshots have no name — the API
 * offers only `created_at` and the blob — so its size is the only thing that
 * distinguishes two saves a minute apart, and it is better than nothing. */
export function sizeOf(state: unknown): string {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return '—';
  const keys = Object.keys(state).length;
  return `${keys} top-level ${keys === 1 ? 'key' : 'keys'}`;
}
