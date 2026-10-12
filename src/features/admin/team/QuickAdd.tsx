/**
 * The workspace's floating ＋ and its "Quick add" panel (`_quickAddHTML` +
 * `_qaForm`, `darz-studio.html:19371-19391`; save at `:37136`). Owner-only —
 * both things it writes (`/workspace/items/`, `/workspace/contacts/`) are
 * `IsOwner` — so the shell renders it only for the owner.
 *
 * A Task / Idea / Note / Reminder becomes a My-workspace item of that kind; a
 * Contact becomes a contact with its next follow-up. The old toasts are kept
 * ("Added to your workspace", "Contact added"); after a save the panel closes,
 * keeps the chosen type for next time, and the shell re-reads the open tab.
 *
 * The date is the native picker in the old pill (owner decision 2026-10-12),
 * not the old `dzcal` popover.
 */
import { useState } from 'react';
import { useApi, useOptions } from '../../../api/hooks';
import type { ContactPriority, WorkspaceItemCategory } from '../../../api/types';
import { cx } from '../../../lib/cx';
import { choices } from '../saleForm';
import { DuePill } from './fields';
import { useRowWrites } from './useRowWrites';
import {
  DEFAULT_PRIORITY,
  QUICK_ADD_TYPES,
  priorityOptionLabel,
  quickAddSaveLabel,
  startOfToday,
  type QuickAddType,
} from './workspace';

interface Draft {
  title: string;
  body: string;
  category: WorkspaceItemCategory;
  name: string;
  company: string;
  phone: string;
  email: string;
  priority: ContactPriority;
  due: string | null;
  time: string | null;
}

const EMPTY: Draft = {
  title: '',
  body: '',
  category: 'personal',
  name: '',
  company: '',
  phone: '',
  email: '',
  priority: DEFAULT_PRIORITY,
  due: null,
  time: null,
};

export function QuickAdd({
  onSaved,
  say,
}: {
  onSaved: () => void;
  say: (message: string) => void;
}) {
  const { workspace } = useApi();
  const options = useOptions();
  const cats = choices(options, 'workspace.item_category');
  const priorities = choices(options, 'workspace.contact_priority');

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<QuickAddType>('task');
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const writes = useRowWrites();
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    if (busy) return;
    let ok: unknown;
    if (type === 'contact') {
      const name = draft.name.trim();
      if (!name) {
        say('Enter a name');
        return;
      }
      setBusy(true);
      ok = await writes.run(() =>
        workspace.createContact({
          name,
          company: draft.company.trim(),
          phone: draft.phone.trim(),
          email: draft.email.trim(),
          priority: draft.priority,
          next_followup: draft.due,
        }),
      );
      if (ok) say('Contact added');
    } else {
      const title = draft.title.trim();
      if (!title) {
        say('Enter a title');
        return;
      }
      setBusy(true);
      ok = await writes.run(() =>
        workspace.createItem({
          kind: type,
          title,
          body: draft.body.trim(),
          category: draft.category,
          due_date: draft.due,
          due_time: draft.due ? draft.time : null,
        }),
      );
      if (ok) say('Added to your workspace');
    }
    setBusy(false);
    if (!ok) return;
    setDraft(EMPTY); // the old `_qa={type:keep,…}` — the type stays
    setOpen(false);
    onSaved();
  };

  const enterSaves = (e: { key: string }) => {
    if (e.key === 'Enter') void save();
  };

  return (
    <>
      <button
        type="button"
        className="ws-fab"
        title="Quick add"
        aria-label="Quick add"
        onClick={() => setOpen(true)}
      >
        ＋
      </button>
      <div className={cx('ws-qa-scrim', open && 'on')} onClick={() => setOpen(false)} />
      <div
        className={cx('ws-qa', open && 'on')}
        role="dialog"
        aria-label="Quick add"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="ws-qa-head">
          Quick add
          <button
            type="button"
            className="ws-qa-x"
            title="Close"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>
        <div className="ws-qa-types">
          {QUICK_ADD_TYPES.map((t) => (
            <button
              type="button"
              key={t.key}
              className={cx(type === t.key && 'on')}
              aria-pressed={type === t.key}
              onClick={() => setType(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ws-qa-form">
          {type === 'contact' ? (
            <>
              <input
                className="ws-c-f"
                placeholder="Name"
                aria-label="Name"
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
                onKeyDown={enterSaves}
              />
              <input
                className="ws-c-f"
                placeholder="Company / role"
                aria-label="Company / role"
                value={draft.company}
                onChange={(e) => set({ company: e.target.value })}
              />
              <div className="ws-qa-row">
                <input
                  className="ws-c-f"
                  placeholder="Phone"
                  aria-label="Phone"
                  value={draft.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                />
                <input
                  className="ws-c-f"
                  placeholder="Email"
                  aria-label="Email"
                  value={draft.email}
                  onChange={(e) => set({ email: e.target.value })}
                />
              </div>
              <div className="ws-qa-row">
                <select
                  className="ws-c-f"
                  aria-label="Priority"
                  value={draft.priority}
                  onChange={(e) => set({ priority: e.target.value as ContactPriority })}
                >
                  {priorities.map((p) => (
                    <option key={p.value} value={p.value}>
                      {priorityOptionLabel(p.label)}
                    </option>
                  ))}
                </select>
                <DuePill
                  date={draft.due}
                  placeholder="Next follow-up"
                  label="Next follow-up"
                  today={startOfToday()}
                  onChange={(due) => set({ due })}
                />
              </div>
            </>
          ) : (
            <>
              <input
                className="ws-c-f"
                placeholder="What's on your mind?"
                aria-label="Title"
                value={draft.title}
                onChange={(e) => set({ title: e.target.value })}
                onKeyDown={enterSaves}
              />
              <input
                className="ws-c-f"
                placeholder="Note (optional)"
                aria-label="Note"
                value={draft.body}
                onChange={(e) => set({ body: e.target.value })}
              />
              <div className="ws-qa-row">
                <select
                  className="ws-c-f"
                  aria-label="Category"
                  value={draft.category}
                  onChange={(e) => set({ category: e.target.value as WorkspaceItemCategory })}
                >
                  {cats.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <DuePill
                  date={draft.due}
                  time={draft.time}
                  withTime
                  placeholder="Due date"
                  label="Due date"
                  today={startOfToday()}
                  onChange={(due, time) => set({ due, time })}
                />
              </div>
            </>
          )}
          {writes.error && (
            <p className="dz-state err" role="alert">
              {writes.error}
            </p>
          )}
          <button
            type="button"
            className="ws-qa-save"
            disabled={busy}
            onClick={() => void save()}
          >
            {quickAddSaveLabel(type)}
          </button>
        </div>
      </div>
    </>
  );
}
