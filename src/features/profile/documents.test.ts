/**
 * "Your documents" — the per-device seen set (`darz_docs_seen`, app.html
 * :7888-7891) and the row copy. Node project: the storage is a stand-in.
 */
import { describe, expect, it } from 'vitest';
import type { CollectorDocument } from '../../api/types';
import { SEEN_KEY, docLabel, docSub, markSeen, readSeen } from './documents';

class MemoryStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}
const mem = () => new MemoryStorage() as unknown as Storage;

const DOC: CollectorDocument = {
  id: 'd1',
  kind: 'invoice',
  title: 'Heech',
  ref: '',
  pdf_url: 'https://x/d1.pdf',
  shared_at: '2026-09-20T10:00:00Z',
  created_at: '2026-09-19T10:00:00Z',
};

describe('the seen set', () => {
  it('starts empty and remembers an opened document once', () => {
    const s = mem();
    expect(readSeen(s)).toEqual([]);
    expect(markSeen(s, 'd1')).toEqual(['d1']);
    expect(markSeen(s, 'd1')).toEqual(['d1']);
    expect(readSeen(s)).toEqual(['d1']);
  });

  it('keeps only the newest 400, as the old app did', () => {
    const s = mem();
    s.setItem(SEEN_KEY, JSON.stringify(Array.from({ length: 400 }, (_, i) => `x${i}`)));
    const next = markSeen(s, 'new');
    expect(next).toHaveLength(400);
    expect(next[0]).toBe('x1');
    expect(next.at(-1)).toBe('new');
  });

  it('survives garbage and a storage that throws', () => {
    const s = mem();
    s.setItem(SEEN_KEY, '{"not":"a list"');
    expect(readSeen(s)).toEqual([]);
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    } as unknown as Storage;
    expect(readSeen(throwing)).toEqual([]);
    expect(markSeen(throwing, 'd1')).toEqual(['d1']);
    expect(readSeen(null)).toEqual([]);
  });
});

describe('row copy', () => {
  it('labels the three old types and falls back to "Document"', () => {
    expect(docLabel('invoice')).toBe('Invoice');
    expect(docLabel('certificate')).toBe('Certificate');
    expect(docLabel('provenance')).toBe('Bill of Sale');
    expect(docLabel('condition_report')).toBe('Document');
  });

  it('writes "<title> · <day month>" from the share date', () => {
    const when = new Date('2026-09-20T10:00:00Z').toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
    expect(docSub(DOC)).toBe(`Heech · ${when}`);
    expect(docSub({ ...DOC, title: ' ', shared_at: null, created_at: 'nope' })).toBe('—');
  });
});
