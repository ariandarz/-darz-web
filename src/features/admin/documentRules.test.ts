import { describe, expect, it } from 'vitest';
import type { DocumentAdmin } from '../../api/types';
import {
  activityAction,
  activityWho,
  attachableDocuments,
  isCollectorVisibleKind,
  ownerLockReason,
  spAgo,
} from './documentRules';

function doc(over: Partial<DocumentAdmin>): DocumentAdmin {
  return {
    id: 'd',
    kind: 'invoice',
    title: 'Invoice',
    object_key: '',
    pdf_url: null,
    status: 'draft',
    owner_lock: false,
    collector: null,
    shared_at: null,
    created_by: null,
    confirmed_at: null,
    confirmed_by: null,
    signed_at: null,
    signed_by: null,
    version: 1,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...over,
  } as DocumentAdmin;
}

describe('ownerLockReason — the UI half of services.py:17-19', () => {
  it('a standard admin on a locked document gets the reason', () => {
    expect(ownerLockReason(doc({ owner_lock: true }), 'standard_admin')).toMatch(
      /^Owner-locked — only the owner/,
    );
  });
  it('the owner is never locked out, and an unlocked document locks no one', () => {
    expect(ownerLockReason(doc({ owner_lock: true }), 'owner')).toBeNull();
    expect(ownerLockReason(doc({ owner_lock: false }), 'standard_admin')).toBeNull();
    expect(ownerLockReason(null, 'standard_admin')).toBeNull();
  });
});

describe('the collector-visible kinds (models.py:39-42)', () => {
  it('matches the backend allow-list exactly', () => {
    for (const k of ['invoice', 'certificate', 'provenance', 'contract', 'receipt']) {
      expect(isCollectorVisibleKind(k)).toBe(true);
    }
    for (const k of ['proposal', 'pricelist', 'legal_terms', '', null]) {
      expect(isCollectorVisibleKind(k)).toBe(false);
    }
  });
});

describe('History rows (G-DOC-2, flat actor — C-15)', () => {
  it('who is actor_name, or "system" when there is none', () => {
    expect(activityWho({ actor: 'u1', actor_name: 'Arian' })).toBe('Arian');
    expect(activityWho({ actor: null, actor_name: null })).toBe('system');
    expect(activityWho({ actor: 'u1', actor_name: '  ' })).toBe('system');
  });
  it('the action is the server verb, capitalised', () => {
    expect(activityAction('share')).toBe('Share');
    expect(activityAction('transition')).toBe('Transition');
    expect(activityAction('')).toBe('—');
  });
  it('spAgo keeps the old today / yesterday / Nd ago steps', () => {
    const now = Date.parse('2026-09-25T12:00:00Z');
    expect(spAgo('2026-09-25T09:00:00Z', now)).toBe('today');
    expect(spAgo('2026-09-24T09:00:00Z', now)).toBe('yesterday');
    expect(spAgo('2026-09-20T12:00:00Z', now)).toBe('5d ago');
    expect(spAgo(null, now)).toBe('—');
    expect(spAgo('2026-01-01T00:00:00Z', now)).not.toMatch(/ago|today/);
  });
});

describe('attachableDocuments — never move another collector’s document', () => {
  const rows = [
    doc({ id: 'mine-old', collector: 'c1', updated_at: '2026-09-01T00:00:00Z' }),
    doc({ id: 'free', collector: null, updated_at: '2026-09-10T00:00:00Z' }),
    doc({ id: 'mine-new', collector: 'c1', updated_at: '2026-09-05T00:00:00Z' }),
    doc({ id: 'theirs', collector: 'c2' }),
    doc({ id: 'proposal', kind: 'proposal' }),
    doc({ id: 'shelved', status: 'archived' }),
  ];
  it('this collector’s first (newest first), then the unissued ones', () => {
    expect(attachableDocuments(rows, 'c1').map((d) => d.id)).toEqual([
      'mine-new',
      'mine-old',
      'free',
    ]);
  });
  it('with no collector known, only the unissued ones', () => {
    expect(attachableDocuments(rows, null).map((d) => d.id)).toEqual(['free']);
  });
});
