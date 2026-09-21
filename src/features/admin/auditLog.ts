/**
 * Audit-log formatting — pure, so it is testable without a DOM (this repo runs
 * vitest with no jsdom, by design).
 *
 * The old panel's Settings tab kept its own log in `platformSettings.audit`
 * (`darz-studio.html:16748`) and rendered each row as **what** over
 * *from → to*, with *who · when* beside it (`:17084-17087`). The server log is
 * richer — it covers every privileged mutation in the system, not just settings
 * changes — but it carries the same three pieces, so the row reads the same way:
 *
 *   `action` on `entity_type`        ← the "what"
 *   field: from → to                 ← the "change"
 *   actor · at                       ← the "who · when"
 *
 * `changes` is `{field: [from, to]}` (`apps/core/audit.py::record_audit`), but
 * it is a freeform JSONField on the wire, so every shape below is defended
 * against rather than assumed.
 */
import type { AuditLogEntry } from '../../api/types';

export interface ChangeLine {
  field: string;
  from: string;
  to: string;
}

const EMPTY = '—';

/** One display string for any JSON value. Objects and arrays are shown as
 * compact JSON rather than `[object Object]`; a long value is cut, because a
 * change line is a glance, not the payload. */
export function valueText(value: unknown, max = 80): string {
  if (value === null || value === undefined || value === '') return EMPTY;
  if (typeof value === 'string')
    return value.length > max ? value.slice(0, max - 1) + '…' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch {
    return EMPTY; // circular, or otherwise not serialisable
  }
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

/**
 * The `{field: [from, to]}` map as display lines, in the order the server sent
 * them (object key order — the services build these maps deliberately).
 *
 * Two real shapes are tolerated: the documented pair, and a bare value, which
 * services occasionally record for a create where there is no "from". A bare
 * value is shown as `— → value`, which is what a create means.
 */
export function changeLines(changes: unknown): ChangeLine[] {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return [];
  return Object.entries(changes as Record<string, unknown>).map(([field, raw]) => {
    if (Array.isArray(raw) && raw.length === 2) {
      return { field, from: valueText(raw[0]), to: valueText(raw[1]) };
    }
    return { field, from: EMPTY, to: valueText(raw) };
  });
}

/** `catalog.Artwork` → `Artwork`. The app label repeats the group the desk is
 * already in, so the row shows the model and the title carries the rest. */
export function entityLabel(entityType: string): string {
  const dot = entityType.lastIndexOf('.');
  return dot === -1 ? entityType : entityType.slice(dot + 1);
}

/** `price_amount` → `Price amount`. */
export function fieldLabel(field: string): string {
  const spaced = field.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The old desk's "Export CSV" (`DZSet.exportAudit`), over the server log.
 * One row per change line so the file is analysable, plus one row for an entry
 * that recorded no changes (a delete, typically) — dropping those would make
 * the export quietly disagree with the screen. */
export function auditCsv(entries: readonly AuditLogEntry[]): string {
  const header = ['when', 'actor', 'action', 'entity', 'entity_id', 'field', 'from', 'to'];
  const rows: string[][] = [];
  for (const e of entries) {
    const base = [e.at, e.actor?.name ?? '', e.action, e.entity_type, e.entity_id];
    const lines = changeLines(e.changes);
    if (lines.length === 0) rows.push([...base, '', '', '']);
    else for (const l of lines) rows.push([...base, l.field, l.from, l.to]);
  }
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** RFC 4180: quote when the cell contains a comma, a quote or a newline, and
 * double an embedded quote. */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
