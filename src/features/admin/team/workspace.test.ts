/**
 * The Team desk's ported rules (`workspace.ts`) against the old desk's own
 * behaviour in `darz-studio.html`. "Today" is pinned to Thu 12 Oct 2026.
 */
import { describe, expect, it } from 'vitest';
import type { TeamTask, WorkspaceContact, WorkspaceItem } from '../../../api/types';
import {
  chipCount,
  contactTiles,
  daysFromToday,
  dueTone,
  fmtDue,
  fmtMinutes,
  myMatch,
  myShown,
  myTiles,
  quickAddSaveLabel,
  startOfToday,
  tabsFor,
  taskOrder,
  teamTab,
  teamTiles,
} from './workspace';

const TODAY = startOfToday(new Date(2026, 9, 12, 15, 30));

let seq = 0;
function item(p: Partial<WorkspaceItem>): WorkspaceItem {
  seq++;
  return {
    id: `i${seq}`,
    kind: 'task',
    category: 'personal',
    title: `Item ${seq}`,
    body: '',
    due_date: null,
    due_time: null,
    done: false,
    done_at: null,
    version: 1,
    created_at: `2026-10-0${(seq % 9) + 1}T10:00:00Z`,
    updated_at: '2026-10-01T10:00:00Z',
    ...p,
  };
}
function contact(p: Partial<WorkspaceContact>): WorkspaceContact {
  seq++;
  return {
    id: `c${seq}`,
    name: `Contact ${seq}`,
    company: '',
    phone: '',
    email: '',
    priority: 'med',
    last_contact: null,
    next_followup: null,
    notes: '',
    collector: null,
    artist: null,
    version: 1,
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
    ...p,
  };
}
function task(p: Partial<TeamTask>): TeamTask {
  seq++;
  return {
    id: `t${seq}`,
    title: `Task ${seq}`,
    assignee: null,
    status: 'todo',
    due_date: null,
    done_at: null,
    minutes_logged: 0,
    version: 1,
    created_at: `2026-10-0${(seq % 9) + 1}T10:00:00Z`,
    updated_at: '2026-10-01T10:00:00Z',
    ...p,
  };
}

describe('tabs and gating', () => {
  it('lands the owner on My workspace and a standard admin on Team', () => {
    expect(teamTab(null, 'owner')).toBe('me');
    expect(teamTab(null, 'standard_admin')).toBe('team');
    expect(teamTab('nonsense', 'standard_admin')).toBe('team');
  });

  it('honours an explicit owner tab for anyone — RequireOwner answers it', () => {
    expect(teamTab('contacts', 'standard_admin')).toBe('contacts');
  });

  it('offers a standard admin the Team tab alone', () => {
    expect(tabsFor('owner').map((t) => t.key)).toEqual(['me', 'team', 'contacts', 'logins']);
    expect(tabsFor('standard_admin').map((t) => t.key)).toEqual(['team']);
  });
});

describe('dates — _daysFromToday / _fmtDue / the pill tone', () => {
  it('counts calendar days from local midnight', () => {
    expect(daysFromToday('2026-10-12', TODAY)).toBe(0);
    expect(daysFromToday('2026-10-13', TODAY)).toBe(1);
    expect(daysFromToday('2026-10-05', TODAY)).toBe(-7);
    expect(daysFromToday(null, TODAY)).toBeNull();
    expect(daysFromToday('not a date', TODAY)).toBeNull();
  });

  it('formats like the old pill, with the wire time cut to HH:MM', () => {
    expect(fmtDue('2026-10-12', null, TODAY)).toBe('Today');
    expect(fmtDue('2026-10-13', '09:30:00', TODAY)).toBe('Tomorrow · 09:30');
    expect(fmtDue('2026-10-11', null, TODAY)).toBe('Yesterday');
    expect(fmtDue('2026-11-04', null, TODAY)).toBe('Nov 4');
    expect(fmtDue('2027-01-02', null, TODAY)).toBe('Jan 2, 2027');
  });

  it('is red when past and blue for today/tomorrow', () => {
    expect(dueTone('2026-10-11', TODAY)).toBe('over');
    expect(dueTone('2026-10-12', TODAY)).toBe('soon');
    expect(dueTone('2026-10-13', TODAY)).toBe('soon');
    expect(dueTone('2026-10-14', TODAY)).toBe('');
    expect(dueTone(null, TODAY)).toBe('');
  });
});

describe('My workspace — _myMatch, the tiles and the list', () => {
  it('matches ideas and follow-ups by kind OR category', () => {
    expect(myMatch(item({ kind: 'idea', category: 'darz' }), 'ideas', TODAY)).toBe(true);
    expect(myMatch(item({ kind: 'task', category: 'ideas' }), 'ideas', TODAY)).toBe(true);
    expect(myMatch(item({ kind: 'followup', category: 'darz' }), 'followup', TODAY)).toBe(
      true,
    );
    expect(myMatch(item({ kind: 'task', category: 'followup' }), 'followup', TODAY)).toBe(
      true,
    );
    expect(myMatch(item({ kind: 'task', category: 'darz' }), 'darz', TODAY)).toBe(true);
    expect(myMatch(item({ kind: 'task', category: 'darz' }), 'koocheh', TODAY)).toBe(false);
  });

  it('treats overdue as past AND not done; this week as today..+7', () => {
    expect(myMatch(item({ due_date: '2026-10-10' }), 'overdue', TODAY)).toBe(true);
    expect(myMatch(item({ due_date: '2026-10-10', done: true }), 'overdue', TODAY)).toBe(
      false,
    );
    expect(myMatch(item({ due_date: '2026-10-19' }), 'week', TODAY)).toBe(true);
    expect(myMatch(item({ due_date: '2026-10-20' }), 'week', TODAY)).toBe(false);
    expect(myMatch(item({ due_date: '2026-10-11' }), 'week', TODAY)).toBe(false);
  });

  it('counts the six tiles like :19301, contacts due within 14 days included', () => {
    const items = [
      item({ kind: 'task' }),
      item({ kind: 'task', due_date: '2026-10-01' }),
      item({ kind: 'note' }),
      item({ kind: 'idea' }),
      item({ kind: 'followup' }),
      item({ kind: 'task', done: true }),
    ];
    const contacts = [
      contact({ next_followup: '2026-10-20' }),
      contact({ next_followup: '2026-10-30' }), // 18 days — out
      contact({ next_followup: '2026-10-01' }), // overdue — not a follow-up tile count
    ];
    expect(myTiles(items, contacts, TODAY)).toEqual({
      openTasks: 2,
      followUps: 2,
      overdue: 1,
      completed: 1,
      notes: 1,
      ideas: 1,
    });
  });

  it('counts a chip over open items only', () => {
    const items = [
      item({ category: 'darz' }),
      item({ category: 'darz', done: true }),
      item({ category: 'team' }),
    ];
    expect(chipCount(items, 'darz', TODAY)).toBe(1);
    expect(chipCount(items, 'all', TODAY)).toBe(2);
  });

  it('lists open before done, soonest due first, then newest', () => {
    const a = item({ title: 'undated new', created_at: '2026-10-09T00:00:00Z' });
    const b = item({ title: 'undated old', created_at: '2026-10-02T00:00:00Z' });
    const c = item({ title: 'due later', due_date: '2026-10-20' });
    const d = item({ title: 'due soon', due_date: '2026-10-13' });
    const e = item({ title: 'done', done: true, due_date: '2026-10-12' });
    expect(myShown([a, b, c, d, e], 'all', TODAY).map((i) => i.title)).toEqual([
      'due soon',
      'due later',
      'undated new',
      'undated old',
      'done',
    ]);
  });

  it('hides done items under every filter but All and Completed', () => {
    const open = item({ category: 'darz' });
    const done = item({ category: 'darz', done: true });
    expect(myShown([open, done], 'darz', TODAY)).toEqual([open]);
    expect(myShown([open, done], 'done', TODAY)).toEqual([done]);
  });
});

describe('Team workflow — ttFmt, the order and the tiles', () => {
  it('formats minutes like ttFmt', () => {
    expect(fmtMinutes(0)).toBe('0m');
    expect(fmtMinutes(45)).toBe('45m');
    expect(fmtMinutes(60)).toBe('1h ');
    expect(fmtMinutes(75)).toBe('1h 15m');
    expect(fmtMinutes(null)).toBe('0m');
  });

  it('puts done tasks last, newest first within each', () => {
    const older = task({ title: 'older', created_at: '2026-10-01T00:00:00Z' });
    const newer = task({ title: 'newer', created_at: '2026-10-05T00:00:00Z' });
    const done = task({ title: 'done', status: 'done', created_at: '2026-10-09T00:00:00Z' });
    expect(taskOrder([done, older, newer]).map((t) => t.title)).toEqual([
      'newer',
      'older',
      'done',
    ]);
  });

  it('totals open, done and the server-derived minutes', () => {
    const tasks = [
      task({ status: 'todo', minutes_logged: 15 }),
      task({ status: 'doing', minutes_logged: 30 }),
      task({ status: 'done', minutes_logged: 60 }),
    ];
    expect(teamTiles(tasks)).toEqual({ open: 2, done: 1, minutes: 105 });
  });
});

describe('Contacts — the three tiles', () => {
  it('counts follow-ups due within 7 days, overdue included, and high priority', () => {
    const cs = [
      contact({ priority: 'high', next_followup: '2026-10-01' }),
      contact({ priority: 'high', next_followup: '2026-10-19' }),
      contact({ priority: 'low', next_followup: '2026-10-20' }),
      contact({ priority: 'med' }),
    ];
    expect(contactTiles(cs, TODAY)).toEqual({ total: 4, dueSoon: 2, high: 2 });
  });
});

describe('quick add', () => {
  it('names the save button after the type', () => {
    expect(quickAddSaveLabel('task')).toBe('Add task');
    expect(quickAddSaveLabel('idea')).toBe('Add idea');
    expect(quickAddSaveLabel('reminder')).toBe('Add reminder');
    expect(quickAddSaveLabel('contact')).toBe('Add contact');
  });
});
