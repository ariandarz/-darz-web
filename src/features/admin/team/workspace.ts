/**
 * The Team desk's pure rules — everything in the old `teamView` that is logic
 * rather than markup, so it can be tested without a DOM. Each function names
 * its source in `darz-studio.html`; the date helpers take `today` so a test
 * can pin it (the old ones read `new Date()` inline).
 *
 * What moved server-side and is NOT here: the Contacts order (the list is
 * served high→med→low, then soonest follow-up — rendered as served), and the
 * time total on a task (`minutes_logged`, derived from the append-only logs).
 */
import type {
  ContactPriority,
  TeamTask,
  WorkspaceContact,
  WorkspaceItem,
  WorkspaceItemCategory,
  WorkspaceItemKind,
} from '../../../api/types';
import type { AdminRole } from '../adminNav';

/* ---- The desk's tabs ------------------------------------------------------ */

/** `_teamTab` (`:19249`) plus this port's fourth, the logins desk (owner
 * decision 2026-10-12 — the old logins lived in a separate overlay, `:20648`). */
export type TeamTab = 'me' | 'team' | 'contacts' | 'logins';

/** The tabs backed by `IsOwner` routes — gated with `RequireOwner`. */
export const OWNER_TABS: ReadonlySet<TeamTab> = new Set(['me', 'contacts', 'logins']);

/** In switcher order. The first three are `:19423-19425`, verbatim. */
export const TEAM_TABS: ReadonlyArray<{ key: TeamTab; label: string }> = [
  { key: 'me', label: 'My workspace' },
  { key: 'team', label: 'Team' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'logins', label: 'Logins' },
];

/** The heading and line over each tab (`T`, `:19421`), verbatim. "Syncs
 * across your devices" still holds — one database serves every device, which
 * is a stronger form of what the old localStorage sync promised. */
export const TAB_HEAD: Record<TeamTab, { title: string; sub: string }> = {
  me: {
    title: 'My workspace',
    sub: 'Your private desk — tasks, notes, ideas, follow-ups and reminders, all in one calm place. Syncs across your devices.',
  },
  team: {
    title: 'Team workflow & performance',
    sub: 'Assign tasks, track status and time spent, and approve pricelists. Syncs across admin devices.',
  },
  contacts: {
    title: 'Contacts & follow-ups',
    sub: 'People, collectors, artists and opportunities — with the next time you mean to reach them. Syncs across your devices.',
  },
  logins: {
    // the old overlay's own heading, `:36770`
    title: 'Team logins',
    sub: 'Sign-ins for the desk.',
  },
};

/** `?tab=` → the tab to show. The owner lands on My workspace (`_teamTab='me'`);
 * a standard admin, who has only the Team tab, lands there. An explicit
 * owner-only tab is honoured for anyone — `RequireOwner` then answers a
 * standard admin with the refusal card rather than silently switching. */
export function teamTab(param: string | null, role: AdminRole): TeamTab {
  const known = TEAM_TABS.find((t) => t.key === param)?.key;
  if (known) return known;
  return role === 'owner' ? 'me' : 'team';
}

/** The switcher's buttons for this role. */
export function tabsFor(role: AdminRole): ReadonlyArray<{ key: TeamTab; label: string }> {
  return role === 'owner' ? TEAM_TABS : TEAM_TABS.filter((t) => !OWNER_TABS.has(t.key));
}

/* ---- Dates (`:19259-19266`) ------------------------------------------------ */

/** Local midnight today — `_daysFromToday` compares calendar days. */
export function startOfToday(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** `_parseIso` — a `YYYY-MM-DD` (or longer) string as a local date. */
export function parseIso(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d\d-\d\d/.test(s)) return null;
  const [y, m, d] = s.slice(0, 10).split('-');
  return new Date(+y, +m - 1, +d);
}

/** `_daysFromToday` — whole days from today; `null` when there is no date. */
export function daysFromToday(iso: string | null | undefined, today: Date): number | null {
  const d = parseIso(iso);
  if (!d) return null;
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

/** The wire's `due_time` is `HH:MM:SS`; the old desk stored and showed `HH:MM`. */
export function shortTime(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : '';
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** `_fmtDue` — Today / Tomorrow / Yesterday / "Mar 4" (+ year when not this
 * year), then " · HH:MM" when a time is set. */
export function fmtDue(
  iso: string | null | undefined,
  time: string | null,
  today: Date,
): string {
  const d = parseIso(iso);
  if (!d) return '';
  const n = daysFromToday(iso, today);
  let s: string;
  if (n === 0) s = 'Today';
  else if (n === 1) s = 'Tomorrow';
  else if (n === -1) s = 'Yesterday';
  else {
    s = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
    if (d.getFullYear() !== today.getFullYear()) s += `, ${d.getFullYear()}`;
  }
  const t = shortTime(time);
  if (t) s += ` · ${t}`;
  return s;
}

/** `_duePill`'s tone (`:19270`): past → `over`, today or tomorrow → `soon`. */
export function dueTone(iso: string | null | undefined, today: Date): '' | 'soon' | 'over' {
  const n = daysFromToday(iso, today);
  if (n == null) return '';
  if (n < 0) return 'over';
  if (n <= 1) return 'soon';
  return '';
}

/* ---- My workspace (`:19281-19316`) ------------------------------------------ */

/** The filter rail (`WS_FILTERS`, `:19256`): three date views, then one per
 * category. The category labels come from `/api/options/`
 * (`workspace.item_category`); these three are the desk's own words. */
export type MyFilter =
  | 'all'
  | 'today'
  | 'week'
  | 'done'
  | 'overdue'
  | 'notes'
  | 'ideas'
  | 'followup'
  | WorkspaceItemCategory;
export const MY_DATE_FILTERS: ReadonlyArray<{ key: MyFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
];

/** The kinds that get a checkbox; the rest (idea · note · opportunity) get a
 * coloured dot (`checkable`, `:19296`). */
export const CHECKABLE_KINDS: ReadonlySet<WorkspaceItemKind> = new Set([
  'task',
  'followup',
  'call',
  'meeting',
  'reminder',
]);

/** `_myMatch` (`:19281`) — note `ideas` and `followup` match by kind OR
 * category, which no single server filter can express. */
export function myMatch(it: WorkspaceItem, f: MyFilter, today: Date): boolean {
  if (f === 'all') return true;
  if (f === 'done') return !!it.done;
  const dn = daysFromToday(it.due_date, today);
  const kind = it.kind ?? 'task';
  const cat = it.category ?? 'personal';
  if (f === 'overdue') return !it.done && dn != null && dn < 0;
  if (f === 'notes') return kind === 'note';
  if (f === 'today') return dn === 0;
  if (f === 'week') return dn != null && dn >= 0 && dn <= 7;
  if (f === 'ideas') return kind === 'idea' || cat === 'ideas';
  if (f === 'followup') return kind === 'followup' || cat === 'followup';
  return cat === f;
}

/** A chip's count: open items it matches (`:19305`). */
export function chipCount(items: readonly WorkspaceItem[], f: MyFilter, today: Date): number {
  return items.filter((i) => !i.done && myMatch(i, f, today)).length;
}

export interface MyTiles {
  openTasks: number;
  followUps: number;
  overdue: number;
  completed: number;
  notes: number;
  ideas: number;
}

/** The six tiles (`:19301-19303`). Follow-ups also count contacts whose next
 * follow-up falls in the coming fortnight. */
export function myTiles(
  items: readonly WorkspaceItem[],
  contacts: readonly WorkspaceContact[],
  today: Date,
): MyTiles {
  const t: MyTiles = {
    openTasks: 0,
    followUps: 0,
    overdue: 0,
    completed: 0,
    notes: 0,
    ideas: 0,
  };
  for (const i of items) {
    if (i.done) {
      t.completed++;
      continue;
    }
    const k = i.kind ?? 'task';
    if (k === 'task') t.openTasks++;
    if (k === 'note') t.notes++;
    if (k === 'idea' || i.category === 'ideas') t.ideas++;
    if (k === 'followup' || i.category === 'followup') t.followUps++;
    const n = daysFromToday(i.due_date, today);
    if (n != null && n < 0) t.overdue++;
  }
  for (const c of contacts) {
    const n = daysFromToday(c.next_followup, today);
    if (n != null && n >= 0 && n <= 14) t.followUps++;
  }
  return t;
}

/** `_dueSort` (`:19267`): dated first, soonest first. */
function dueSort(a: WorkspaceItem, b: WorkspaceItem): number {
  const da = parseIso(a.due_date);
  const db = parseIso(b.due_date);
  if (da && db) return da.getTime() - db.getTime();
  if (da) return -1;
  if (db) return 1;
  return 0;
}

/** The list under the rail (`:19310-19312`): the filter, open-only for any
 * filter but All/Completed, then open first → soonest due → newest. */
export function myShown(
  items: readonly WorkspaceItem[],
  f: MyFilter,
  today: Date,
): WorkspaceItem[] {
  let shown = items.filter((i) => myMatch(i, f, today));
  if (f !== 'all' && f !== 'done') shown = shown.filter((i) => !i.done);
  return shown.sort(
    (a, b) =>
      (a.done ? 1 : 0) - (b.done ? 1 : 0) ||
      dueSort(a, b) ||
      Date.parse(b.created_at) - Date.parse(a.created_at),
  );
}

/* ---- Team workflow (`:19317-19357`) ------------------------------------------ */

/** `ttFmt` (`:19243`) — "1h 5m", "2h", "45m", "0m". */
export function fmtMinutes(m: number | null | undefined): string {
  const total = Number(m) || 0;
  const h = Math.floor(total / 60);
  const mm = total % 60;
  return (h ? `${h}h ` : '') + (mm || !h ? `${mm}m` : '');
}

/** The task list's order (`:19323`): open before done, newest first. */
export function taskOrder(tasks: readonly TeamTask[]): TeamTask[] {
  return tasks
    .slice()
    .sort(
      (a, b) =>
        (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) ||
        Date.parse(b.created_at) - Date.parse(a.created_at),
    );
}

/** The three tiles (`:19337`): open, done, and all time logged. */
export function teamTiles(tasks: readonly TeamTask[]): {
  open: number;
  done: number;
  minutes: number;
} {
  let open = 0;
  let done = 0;
  let minutes = 0;
  for (const t of tasks) {
    if (t.status === 'done') done++;
    else open++;
    minutes += Number(t.minutes_logged) || 0;
  }
  return { open, done, minutes };
}

/* ---- Contacts (`:19359-19363`) ------------------------------------------------ */

/** The three tiles: all contacts, follow-ups due within a week (overdue
 * included — the server's `followup_due_soon=7` rule), and high priority. */
export function contactTiles(
  contacts: readonly WorkspaceContact[],
  today: Date,
): { total: number; dueSoon: number; high: number } {
  let dueSoon = 0;
  let high = 0;
  for (const c of contacts) {
    const n = daysFromToday(c.next_followup, today);
    if (n != null && n <= 7) dueSoon++;
    if ((c.priority ?? 'med') === 'high') high++;
  }
  return { total: contacts.length, dueSoon, high };
}

/* ---- Quick add (`:19371-19391`) ------------------------------------------------ */

/** `_qaTypesHTML` (`:19383`), verbatim. */
export type QuickAddType = 'task' | 'idea' | 'note' | 'reminder' | 'contact';
export const QUICK_ADD_TYPES: ReadonlyArray<{ key: QuickAddType; label: string }> = [
  { key: 'task', label: 'Task' },
  { key: 'idea', label: 'Idea' },
  { key: 'note', label: 'Note' },
  { key: 'reminder', label: 'Reminder' },
  { key: 'contact', label: 'Contact' },
];

/** The save button's words (`:19381`). */
export function quickAddSaveLabel(type: QuickAddType): string {
  if (type === 'contact') return 'Add contact';
  return `Add ${type === 'idea' ? 'idea' : type === 'note' ? 'note' : type === 'reminder' ? 'reminder' : 'task'}`;
}

/** The contact priority option's words in the quick-add form (`:19376`) —
 * "High priority" etc., built on the served label. */
export function priorityOptionLabel(label: string): string {
  return `${label} priority`;
}

export const DEFAULT_PRIORITY: ContactPriority = 'med';
