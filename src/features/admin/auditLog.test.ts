/** The audit log's formatting rules. `changes` is a freeform JSONField on the
 * wire, so the shapes it is NOT supposed to have are the interesting cases. */
import { describe, expect, it } from 'vitest';
import type { AuditLogEntry } from '../../api/types';
import { auditCsv, changeLines, entityLabel, fieldLabel, valueText } from './auditLog';

describe('changeLines', () => {
  it('reads the documented {field: [from, to]} shape', () => {
    expect(changeLines({ status: ['draft', 'published'] })).toEqual([
      { field: 'status', from: 'draft', to: 'published' },
    ]);
  });

  it('keeps the server order rather than sorting — the services build these deliberately', () => {
    const lines = changeLines({ zeta: [1, 2], alpha: [3, 4] });
    expect(lines.map((l) => l.field)).toEqual(['zeta', 'alpha']);
  });

  it('shows a bare value as a create: — → value', () => {
    expect(changeLines({ title: 'Untitled' })).toEqual([
      { field: 'title', from: '—', to: 'Untitled' },
    ]);
  });

  it('a 3-element array is a value, not a pair — it must not silently lose an element', () => {
    expect(changeLines({ tags: [1, 2, 3] })).toEqual([
      { field: 'tags', from: '—', to: '[1,2,3]' },
    ]);
  });

  it('survives every non-object `changes` the JSONField can hold', () => {
    expect(changeLines(null)).toEqual([]);
    expect(changeLines(undefined)).toEqual([]);
    expect(changeLines('nope')).toEqual([]);
    expect(changeLines(42)).toEqual([]);
    expect(changeLines([1, 2])).toEqual([]);
    expect(changeLines({})).toEqual([]);
  });
});

describe('valueText', () => {
  it('renders the empty cases as an em dash, but keeps a real false and zero', () => {
    expect(valueText(null)).toBe('—');
    expect(valueText(undefined)).toBe('—');
    expect(valueText('')).toBe('—');
    expect(valueText(false)).toBe('false');
    expect(valueText(0)).toBe('0');
  });

  it('shows an object as compact JSON, never [object Object]', () => {
    expect(valueText({ a: 1 })).toBe('{"a":1}');
  });

  it('truncates past the cap', () => {
    expect(valueText('x'.repeat(100), 10)).toBe('x'.repeat(9) + '…');
  });

  it('a circular value degrades to an em dash instead of throwing', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(valueText(loop)).toBe('—');
  });
});

describe('labels', () => {
  it('drops the app label from the entity type', () => {
    expect(entityLabel('catalog.Artwork')).toBe('Artwork');
    expect(entityLabel('Artwork')).toBe('Artwork');
  });

  it('humanises a field name', () => {
    expect(fieldLabel('price_amount')).toBe('Price amount');
  });
});

const entry = (over: Partial<AuditLogEntry> = {}): AuditLogEntry =>
  ({
    id: 'a1',
    actor: { id: 'u1', name: 'Arian' },
    action: 'update',
    entity_type: 'catalog.Artwork',
    entity_id: 'w1',
    changes: { status: ['draft', 'published'] },
    at: '2026-09-21T10:00:00Z',
    ...over,
  }) as AuditLogEntry;

describe('auditCsv', () => {
  it('writes one row per change line, under a header', () => {
    const csv = auditCsv([entry({ changes: { a: [1, 2], b: [3, 4] } })]);
    const rows = csv.split('\r\n');
    expect(rows[0]).toBe('when,actor,action,entity,entity_id,field,from,to');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toContain(',a,1,2');
    expect(rows[2]).toContain(',b,3,4');
  });

  it('still writes a row for an entry with no changes — a delete must not vanish', () => {
    const csv = auditCsv([entry({ action: 'delete', changes: {} })]);
    expect(csv.split('\r\n')).toHaveLength(2);
    expect(csv).toContain('delete');
  });

  it('a missing actor leaves the cell blank rather than printing null', () => {
    expect(auditCsv([entry({ actor: null })])).toContain(',,update,');
  });

  it('quotes a cell containing a comma, and doubles an embedded quote', () => {
    const csv = auditCsv([entry({ changes: { note: ['a,b', 'say "hi"'] } })]);
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"say ""hi"""');
  });
});
