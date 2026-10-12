/**
 * The Team desk's three inline controls — the old desk edits every row in
 * place (`onchange="DarzAdmin.myField(…)"`, `:19298`), and these are that
 * shape in React.
 *
 *  - `InlineText` commits on blur (and Enter, for one line), only when the
 *    value changed — the old `onchange` event, which fires exactly then.
 *    It is uncontrolled and the caller keys it on the row's `version`, so a
 *    saved (or reloaded) row resets it to the server's value.
 *  - `DuePill` is the old `_duePill` (`:19268`) — the calendar button with
 *    "Today" / "Tomorrow" / "Mar 4" in it, red when past, blue when near —
 *    with the platform's date picker in place of the old custom `dzcal`
 *    popover (owner decision 2026-10-12). The time, when the row has one, is
 *    a small time field beside it, as the popover's foot had (`:19493`).
 *  - `ChoiceSelect` is a `.ws-sel` over a `/api/options/` list.
 */
import { useId, type KeyboardEvent } from 'react';
import type { Choice } from '../../../api/types';
import { cx } from '../../../lib/cx';
import { dueTone, fmtDue } from './workspace';

export function InlineText({
  value,
  onCommit,
  className,
  placeholder,
  label,
  multiline = false,
}: {
  value: string;
  onCommit: (next: string) => void;
  className: string;
  placeholder?: string;
  /** an accessible name — the old inputs had only a placeholder */
  label: string;
  multiline?: boolean;
}) {
  const commit = (next: string) => {
    if (next !== value) onCommit(next);
  };
  if (multiline) {
    return (
      <textarea
        className={className}
        defaultValue={value}
        placeholder={placeholder}
        aria-label={label}
        onBlur={(e) => commit(e.target.value)}
      />
    );
  }
  return (
    <input
      className={className}
      defaultValue={value}
      placeholder={placeholder}
      aria-label={label}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

/** The old pill's calendar glyph (`:19273`), verbatim. */
function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function DuePill({
  date,
  time = null,
  withTime = false,
  placeholder,
  today,
  label,
  onChange,
}: {
  date: string | null | undefined;
  time?: string | null;
  /** My-workspace items carry a time; tasks and contacts do not. */
  withTime?: boolean;
  /** The empty pill's words: "Due", "Set", "Next follow-up" … */
  placeholder: string;
  today: Date;
  label: string;
  /** `date` null clears it (and its time). */
  onChange: (date: string | null, time: string | null) => void;
}) {
  const id = useId();
  const iso = date ? date.slice(0, 10) : '';
  const tone = dueTone(iso, today);
  const shown = iso ? fmtDue(iso, withTime ? time : null, today) : placeholder;
  return (
    <>
      <label className={cx('ws-due', !iso && 'empty', tone)} title="Pick a date" htmlFor={id}>
        <CalendarIcon />
        <span>{shown}</span>
        <input
          id={id}
          type="date"
          value={iso}
          aria-label={label}
          onChange={(e) => onChange(e.target.value || null, e.target.value ? time : null)}
        />
      </label>
      {withTime && iso && (
        <input
          type="time"
          className="ws-due-time"
          aria-label={`${label} — time`}
          value={time ? time.slice(0, 5) : ''}
          onChange={(e) => onChange(iso, e.target.value || null)}
        />
      )}
    </>
  );
}

export function ChoiceSelect({
  value,
  choices,
  onChange,
  className = 'ws-sel',
  title,
  label,
  leading,
}: {
  value: string;
  choices: readonly Choice[];
  onChange: (next: string) => void;
  className?: string;
  /** the old `title=` tooltip ("Type", "Category") */
  title?: string;
  label: string;
  /** an option before the served ones — the task owner's "Unassigned" */
  leading?: Choice;
}) {
  return (
    <select
      className={className}
      value={value}
      title={title}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
    >
      {leading && <option value={leading.value}>{leading.label}</option>}
      {choices.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
      {/* a stored value the list does not carry (options not loaded yet, or
          a value the backend no longer serves) still shows as itself */}
      {value && !choices.some((c) => c.value === value) && value !== leading?.value && (
        <option value={value}>{value}</option>
      )}
    </select>
  );
}
