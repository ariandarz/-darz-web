/**
 * The owner-editable half of the bank.
 *
 * `theme` is hand-editable JSON on a freeform endpoint, so everything below is
 * a shape a real save can produce — and the rule is the same one the old app
 * states (`_qbValid`, app.html:9991): an unusable bank falls back to the
 * built-in one rather than handing the collector a blank questionnaire.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { INTRO_DEFAULT, QB_DEFAULT, liveBank, liveIntro } from './questions';
import { __resetOwnerSettings, applyOwnerSettings } from '../shell/ownerSettings';

beforeEach(() => __resetOwnerSettings());

describe('liveBank', () => {
  it('uses the built-in bank when the owner has never edited one', () => {
    expect(liveBank()).toEqual([...QB_DEFAULT]);
  });

  it('falls back on every shape an unusable theme can hold', () => {
    for (const qbQuestions of [
      null,
      [],
      'a string',
      {},
      [{ q: '' }], // cleared the box
      [{ q: 'ok' }, { q: '   ' }], // one blank among good ones
      [{ sec: 'Taste' }], // no question text at all
    ]) {
      applyOwnerSettings({ qbQuestions });
      expect(liveBank()).toEqual([...QB_DEFAULT]);
    }
  });

  it('takes an owner bank and normalises each row', () => {
    applyOwnerSettings({
      qbQuestions: [
        {
          sec: 'Taste',
          hint: 'Choose one',
          q: 'Which era?',
          opts: ['Modern', 'Contemporary'],
        },
      ],
    });
    expect(liveBank()).toEqual([
      {
        sec: 'Taste',
        hint: 'Choose one',
        q: 'Which era?',
        opts: ['Modern', 'Contemporary'],
        extra: undefined,
        note: undefined,
        showIf: undefined,
      },
    ]);
  });

  it('never lets a bad `opts` reach a `.map` — the blank-screen bug', () => {
    // docs/HANDOFF.md §6: `.map` on something that is not an array takes the
    // whole subtree with it. A hand-edited theme is exactly where this arrives.
    applyOwnerSettings({
      qbQuestions: [
        { q: 'No opts key at all' },
        { q: 'opts is an object', opts: { a: 1 } },
        { q: 'opts holds non-strings', opts: ['fine', 42, null] },
      ],
    });
    const bank = liveBank();
    expect(bank.map((b) => b.opts)).toEqual([[], [], ['fine']]);
    expect(() => bank.forEach((b) => b.opts.map((o) => o.length))).not.toThrow();
  });

  it('keeps a well-formed showIf and drops a malformed one', () => {
    applyOwnerSettings({
      qbQuestions: [
        { q: 'A', opts: ['x'] },
        { q: 'B', opts: [], showIf: { q: 'A', has: 'x' } },
        { q: 'C', opts: [], showIf: { q: 'A' } },
        { q: 'D', opts: [], showIf: 'nonsense' },
      ],
    });
    const bank = liveBank();
    expect(bank[1].showIf).toEqual({ q: 'A', has: 'x' });
    expect(bank[2].showIf).toBeUndefined();
    expect(bank[3].showIf).toBeUndefined();
  });
});

describe('liveIntro', () => {
  it('is the built-in wording by default', () => {
    expect(liveIntro()).toEqual(INTRO_DEFAULT);
  });

  it('merges field by field, so a partial edit keeps the rest', () => {
    applyOwnerSettings({ qbIntro: { title: 'Tell us about you', button: 'Start' } });
    const intro = liveIntro();
    expect(intro.title).toBe('Tell us about you');
    expect(intro.button).toBe('Start');
    expect(intro.lede).toBe(INTRO_DEFAULT.lede);
  });

  it('treats a blank or non-string field as unset', () => {
    applyOwnerSettings({ qbIntro: { title: '   ', eyebrow: 42, lede: null } });
    expect(liveIntro()).toEqual(INTRO_DEFAULT);
  });

  it('ignores a qbIntro that is not an object', () => {
    for (const qbIntro of ['text', [1, 2], null, 7]) {
      applyOwnerSettings({ qbIntro });
      expect(liveIntro()).toEqual(INTRO_DEFAULT);
    }
  });
});
