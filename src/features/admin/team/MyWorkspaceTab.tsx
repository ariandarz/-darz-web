/**
 * My workspace — the owner's private desk (`_myTabHTML`, `darz-studio.html:
 * 19299-19316`) over `GET/POST/PATCH/DELETE /workspace/items/` (+ `toggle/`).
 * Owner-only (`IsOwner`); the shell wraps it in `RequireOwner`.
 *
 * Ported as the old desk draws it: six tiles (each one a filter), the filter
 * rail with its open-item counts, the add row, then the items — a checkbox for
 * the doable kinds, a coloured dot for the rest, title and note edited in
 * place, kind / category selects and the due pill. Tiles, counts and order are
 * computed over the whole list (see `workspace.ts`), because two of the old
 * filters match by kind OR category, which no single server filter expresses.
 *
 * Every edit is a locked PATCH with the row's own `version` (the checkbox is
 * `toggle/`); a 409 raises the ConflictBanner, whose Reload re-reads the list.
 */
import { useEffect, useRef, useState } from 'react';
import { MAX_PER_PAGE, walkPages } from '../../../api/paging';
import { useApi, useOptions } from '../../../api/hooks';
import type {
  WorkspaceContact,
  WorkspaceItem,
  WorkspaceItemCategory,
  WorkspaceItemKind,
  WorkspaceItemPatch,
} from '../../../api/types';
import { cx } from '../../../lib/cx';
import { useListController } from '../../shared/useListController';
import { ConfirmDialog, ConflictBanner, DeskBanner, deskBanner } from '../kit';
import { choices, label } from '../saleForm';
import { WorkspaceItemsController } from './controllers';
import { ChoiceSelect, DuePill, InlineText } from './fields';
import { useRowWrites } from './useRowWrites';
import {
  CHECKABLE_KINDS,
  MY_DATE_FILTERS,
  chipCount,
  myShown,
  myTiles,
  startOfToday,
  type MyFilter,
} from './workspace';

export function MyWorkspaceTab({
  refreshKey,
  say,
}: {
  /** bumped by the quick-add panel after it saves */
  refreshKey: number;
  say: (message: string) => void;
}) {
  const { workspace } = useApi();
  const options = useOptions();
  const kinds = choices(options, 'workspace.item_kind');
  const cats = choices(options, 'workspace.item_category');

  const [ctrl] = useState(() => new WorkspaceItemsController(workspace));
  const { state, reload } = useListController(() => ctrl);
  const writes = useRowWrites();

  // The Follow-ups tile also counts contacts due in the coming fortnight
  // (`:19302`). A failed read just leaves them out of the count.
  const [contacts, setContacts] = useState<WorkspaceContact[]>([]);
  useEffect(() => {
    let alive = true;
    walkPages((page) => workspace.contacts({ page, per_page: MAX_PER_PAGE })).then(
      (rows) => alive && setContacts(rows),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [workspace, refreshKey]);

  // the quick-add panel saved — re-read (the first render's read is the hook's)
  const lastKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey === lastKey.current) return;
    lastKey.current = refreshKey;
    void ctrl.reload();
  }, [refreshKey, ctrl]);

  const [filter, setFilter] = useState<MyFilter>('all');
  const [newTitle, setNewTitle] = useState('');
  const [newKind, setNewKind] = useState<WorkspaceItemKind>('task');
  const [newCat, setNewCat] = useState<WorkspaceItemCategory>('personal');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<WorkspaceItem | null>(null);

  const today = startOfToday();
  const items = state.results;
  const tiles = myTiles(items, contacts, today);
  const shown = myShown(items, filter, today);

  /** The row as it is NOW — its version may have moved since this render. */
  const current = (id: string) => ctrl.getSnapshot().results.find((r) => r.id === id);

  const patch = async (id: string, body: Omit<WorkspaceItemPatch, 'expected_version'>) => {
    const row = current(id);
    if (!row) return;
    const saved = await writes.run(() =>
      workspace.updateItem(id, { ...body, expected_version: row.version }),
    );
    if (saved) ctrl.put(saved);
  };

  const toggle = async (id: string) => {
    const row = current(id);
    if (!row) return;
    const saved = await writes.run(() => workspace.toggleItem(id, !row.done, row.version));
    if (saved) ctrl.put(saved);
  };

  const add = async () => {
    const title = newTitle.trim();
    if (!title) {
      say('Type something to add');
      return;
    }
    if (adding) return;
    setAdding(true);
    const saved = await writes.run(() =>
      workspace.createItem({ title, kind: newKind, category: newCat }),
    );
    setAdding(false);
    if (saved) {
      ctrl.put(saved);
      setNewTitle('');
    }
  };

  const remove = async (item: WorkspaceItem) => {
    const ok = await writes.run(() => workspace.deleteItem(item.id).then(() => true));
    if (ok) ctrl.drop(item.id);
  };

  const tile = (n: number, text: string, f: MyFilter, accent?: string) => (
    <button type="button" className={cx('ws-stat', accent)} onClick={() => setFilter(f)}>
      <div className="ws-stat-n">{n}</div>
      <div className="ws-stat-l">{text}</div>
    </button>
  );

  const rail: ReadonlyArray<{ key: MyFilter; label: string }> = [
    ...MY_DATE_FILTERS,
    ...cats.map((c) => ({ key: c.value as MyFilter, label: c.label })),
  ];

  const banner = deskBanner(state.status, state.error, writes.error);

  return (
    <>
      <div className="ws-stats">
        {tile(tiles.openTasks, 'Open tasks', 'all')}
        {tile(tiles.followUps, 'Follow-ups', 'followup', 'due')}
        {tile(tiles.overdue, 'Overdue', 'overdue', 'warn')}
        {tile(tiles.completed, 'Completed', 'done', 'good')}
        {tile(tiles.notes, 'Notes', 'notes')}
        {tile(tiles.ideas, 'Ideas', 'ideas')}
      </div>

      <div className="ws-cats" role="group" aria-label="Filter">
        {rail.map((c) => {
          const n = chipCount(items, c.key, today);
          return (
            <button
              type="button"
              key={c.key}
              className={cx('ws-cat', filter === c.key && 'on')}
              aria-pressed={filter === c.key}
              onClick={() => setFilter(c.key)}
            >
              {c.label}
              {n > 0 && <span className="ws-cat-n">{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="ws-add">
        <input
          className="ws-addinput"
          placeholder="Add a task, note or idea — press Enter to save"
          aria-label="New item"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add();
          }}
        />
        <ChoiceSelect
          label="Type"
          value={newKind}
          choices={kinds}
          onChange={(v) => setNewKind(v as WorkspaceItemKind)}
        />
        <ChoiceSelect
          label="Category"
          value={newCat}
          choices={cats}
          onChange={(v) => setNewCat(v as WorkspaceItemCategory)}
        />
        <button
          type="button"
          className="ws-addbtn"
          disabled={adding}
          onClick={() => void add()}
        >
          Add
        </button>
      </div>

      {writes.conflict && (
        <ConflictBanner
          noun="item"
          onReload={() => {
            writes.clear();
            void reload();
          }}
        />
      )}
      {banner && <DeskBanner>{banner}</DeskBanner>}

      {state.status === 'loading' && items.length === 0 ? (
        <p className="dz-state">Loading…</p>
      ) : shown.length > 0 ? (
        <div className="ws-list">
          {shown.map((it) => {
            const kind = it.kind ?? 'task';
            const done = !!it.done;
            return (
              <div className={cx('ws-item', done && 'is-done')} key={it.id}>
                {CHECKABLE_KINDS.has(kind) ? (
                  <button
                    type="button"
                    className={cx('ws-check', done && 'on')}
                    title={done ? 'Mark not done' : 'Mark done'}
                    aria-label={done ? 'Mark not done' : 'Mark done'}
                    aria-pressed={done}
                    onClick={() => void toggle(it.id)}
                  />
                ) : (
                  <span className={`ws-kdot k-${kind}`} title={label(kinds, kind)} />
                )}
                <div className="ws-body">
                  <InlineText
                    key={`t${it.version}`}
                    className="ws-title"
                    label="Title"
                    placeholder="Untitled"
                    value={it.title ?? ''}
                    onCommit={(title) => void patch(it.id, { title })}
                  />
                  <InlineText
                    key={`b${it.version}`}
                    className="ws-sub"
                    label="Note"
                    placeholder="Add a note…"
                    value={it.body ?? ''}
                    onCommit={(body) => void patch(it.id, { body })}
                  />
                </div>
                <div className="ws-meta">
                  <ChoiceSelect
                    title="Type"
                    label="Type"
                    value={kind}
                    choices={kinds}
                    onChange={(v) => void patch(it.id, { kind: v as WorkspaceItemKind })}
                  />
                  <ChoiceSelect
                    title="Category"
                    label="Category"
                    value={it.category ?? 'personal'}
                    choices={cats}
                    onChange={(v) =>
                      void patch(it.id, { category: v as WorkspaceItemCategory })
                    }
                  />
                  <DuePill
                    date={it.due_date}
                    time={it.due_time ?? null}
                    withTime
                    placeholder="Due"
                    label="Due date"
                    today={today}
                    onChange={(due_date, due_time) =>
                      void patch(it.id, { due_date, due_time })
                    }
                  />
                </div>
                <button
                  type="button"
                  className="ws-x"
                  title="Delete"
                  aria-label="Delete"
                  onClick={() => setDeleting(it)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ws-empty">
          Nothing here yet. Capture a task, note or idea above — or tap the ＋ button anytime.
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          message="Delete this item?"
          okLabel="Delete"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const it = deleting;
            setDeleting(null);
            void remove(it);
          }}
        />
      )}
    </>
  );
}
