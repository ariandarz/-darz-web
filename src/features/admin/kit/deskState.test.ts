/**
 * The desk kit's view/banner rules. These are the two decisions every desk in
 * the panel makes identically, so getting them wrong once is getting them wrong
 * sixteen times.
 */
import { describe, expect, it } from 'vitest';
import { deskBanner, resolveDeskView } from './deskState';

describe('resolveDeskView', () => {
  it('shows the spinner only when there is nothing to show yet', () => {
    expect(resolveDeskView('loading', 0)).toBe('loading');
  });

  it('keeps rows on screen through a reload — no flash back to loading', () => {
    // A filter change re-enters `loading`; taking the table away and putting it
    // back reads as a bug on a desk you are actively filtering.
    expect(resolveDeskView('loading', 7)).toBe('rows');
  });

  it('keeps rows on screen through a failed refresh too', () => {
    // The last good page stays usable; the failure is the banner's job.
    expect(resolveDeskView('error', 7)).toBe('rows');
  });

  it('shows the error view only when it has nothing else to show', () => {
    expect(resolveDeskView('error', 0)).toBe('error');
  });

  it('distinguishes “nothing matched” from “failed”', () => {
    expect(resolveDeskView('idle', 0)).toBe('empty');
    expect(resolveDeskView('error', 0)).toBe('error');
  });

  it('shows rows when there are rows', () => {
    expect(resolveDeskView('idle', 1)).toBe('rows');
  });
});

describe('deskBanner', () => {
  it('is silent on a healthy desk', () => {
    expect(deskBanner('idle', null)).toBeNull();
    expect(deskBanner('loading', null)).toBeNull();
  });

  it('reports a load failure', () => {
    expect(deskBanner('error', 'Network error')).toBe('Network error');
  });

  it('ignores a stale load error once the desk is healthy again', () => {
    // `error` is cleared by the controller on the next load; the banner must
    // not resurrect the message from the snapshot's `error` field alone.
    expect(deskBanner('idle', 'Network error')).toBeNull();
  });

  it('prefers the action error — it is the thing the person just did', () => {
    expect(deskBanner('error', 'Network error', 'That status change conflicts.')).toBe(
      'That status change conflicts.',
    );
  });

  it('shows an action error on an otherwise healthy desk', () => {
    expect(deskBanner('idle', null, 'Version conflict — reload and try again.')).toBe(
      'Version conflict — reload and try again.',
    );
  });
});
