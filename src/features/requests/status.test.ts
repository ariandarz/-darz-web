/**
 * The collector status vocabulary (owner decision D3). The first test is the
 * map's contract: every status the backend can hold, for every kind, has a
 * row — the table is transcribed from `apps/crm/lifecycle.py` `TRANSITIONS` +
 * `KIND_INITIAL_STATUS` on `development` @ 3801786, so a backend change that
 * adds a status fails here instead of reaching a collector as a raw token.
 */
import { describe, expect, it } from 'vitest';
import type { CollectorRequest } from '../../api/types';
import { holdExpiry, MKT_RAIL, requestAmount, statusMeta } from './status';

/** apps/crm/lifecycle.py:14-63 — every kind and every status it can hold. */
const BACKEND_VOCABULARY: Record<string, string[]> = {
  hold: ['requested', 'active', 'expired', 'released', 'converted'],
  offer: ['submitted', 'countered', 'accepted', 'declined', 'withdrawn'],
  viewing: ['requested', 'scheduled', 'completed', 'cancelled'],
  purchase: ['intent', 'qualified', 'negotiation', 'confirmed'],
  information: ['new', 'assigned', 'answered', 'closed'],
  price: ['new', 'assigned', 'answered', 'closed'],
  availability: ['new', 'assigned', 'answered', 'closed'],
  message: ['new', 'assigned', 'answered', 'closed'],
};

function req(kind: string, status: string, detail: unknown = {}): CollectorRequest {
  return { id: 'r', kind, status, detail, artwork: null } as unknown as CollectorRequest;
}

describe('statusMeta — the collector vocabulary (D3)', () => {
  it('knows every status the backend can hold, for every kind', () => {
    const unknown: string[] = [];
    for (const [kind, statuses] of Object.entries(BACKEND_VOCABULARY)) {
      for (const status of statuses) {
        if (statusMeta(req(kind, status)).phase === 'unknown')
          unknown.push(`${kind}/${status}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('shows no pill on a just-filed request, whatever the kind calls that state', () => {
    for (const [kind, first] of [
      ['hold', 'requested'],
      ['offer', 'submitted'],
      ['viewing', 'requested'],
      ['purchase', 'intent'],
      ['information', 'new'],
    ] as const) {
      const meta = statusMeta(req(kind, first));
      expect({ kind, label: meta.label, stage: meta.stage }).toEqual({
        kind,
        label: null,
        stage: 0,
      });
    }
  });

  it('maps each kind onto the old app’s six words and their pill colours', () => {
    expect(statusMeta(req('purchase', 'negotiation'))).toMatchObject({
      label: 'In review',
      pill: 's-rev',
      stage: 1,
    });
    expect(statusMeta(req('information', 'answered'))).toMatchObject({
      label: 'Replied',
      pill: 's-rev',
    });
    expect(statusMeta(req('offer', 'accepted'))).toMatchObject({
      label: 'Accepted',
      pill: 's-ok',
      stage: 2,
    });
    expect(statusMeta(req('viewing', 'completed'))).toMatchObject({
      label: 'Resolved',
      pill: 's-ok',
      stage: 3,
    });
    expect(statusMeta(req('offer', 'declined'))).toMatchObject({
      label: 'Not accepted',
      pill: 's-no',
      stage: -1,
    });
    expect(statusMeta(req('information', 'closed'))).toMatchObject({
      label: 'Closed',
      pill: 's-cl',
      stage: -1,
    });
    expect(MKT_RAIL).toEqual(['Requested', 'In review', 'Accepted', 'Complete']);
  });

  it('carries dzActStatusNote’s per-kind wording', () => {
    expect(statusMeta(req('offer', 'accepted')).note).toBe(
      'Darz has accepted your offer and will contact you to finalize the acquisition.',
    );
    expect(statusMeta(req('hold', 'active')).note).toBe(
      'Darz has accepted your hold request. The work is being kept for you while Darz confirms the next step.',
    );
    expect(statusMeta(req('viewing', 'cancelled')).note).toBe(
      'Darz could not confirm this viewing request. You can write below to arrange another time.',
    );
    expect(statusMeta(req('purchase', 'qualified')).note).toBe(
      'Darz is reviewing your purchase request and will contact you soon.',
    );
    expect(statusMeta(req('price', 'new')).note).toBe(
      'Darz has not replied yet. Their reply appears here, and you can write below.',
    );
  });

  it('falls back to the label /api/options/ publishes, never a guess', () => {
    const meta = statusMeta(req('offer', 'escalated'), { fallbackLabel: 'Escalated' });
    expect(meta.phase).toBe('unknown');
    expect(meta.label).toBe('Escalated');
    expect(meta.note).toBe(
      'Darz updated this request to "escalated". You can write below if you have a question.',
    );
  });

  it('reads an elapsed hold as closed even while the row still says active (G-P5-6)', () => {
    const now = new Date('2026-09-20T12:00:00Z');
    const past = req('hold', 'active', { expires_at: '2026-09-19T12:00:00Z' });
    const future = req('hold', 'active', { expires_at: '2026-09-21T12:00:00Z' });

    expect(statusMeta(past, { now })).toMatchObject({ label: 'Closed', stage: -1 });
    expect(statusMeta(future, { now })).toMatchObject({ label: 'Accepted', stage: 2 });
    expect(holdExpiry(past, now)?.expired).toBe(true);
    expect(holdExpiry(future, now)?.expired).toBe(false);
    expect(holdExpiry(req('offer', 'submitted'), now)).toBeNull();
  });
});

describe('requestAmount — the offer figure on a row', () => {
  it('formats the string the backend returns, and only for an offer', () => {
    expect(
      requestAmount(req('offer', 'submitted', { amount: '30000.00', currency: 'USD' })),
    ).toEqual({ amount: '30,000', currency: 'USD' });
    expect(
      requestAmount(req('offer', 'submitted', { amount: 9500, currency: 'TMN' })),
    ).toEqual({
      amount: '9,500',
      currency: 'TMN',
    });
    expect(requestAmount(req('purchase', 'intent', { notes: '' }))).toBeNull();
    expect(requestAmount(req('offer', 'submitted', {}))).toBeNull();
  });
});
