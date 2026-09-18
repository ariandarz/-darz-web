/**
 * The toolbar controls every desk filters with.
 *
 * All three wrap `.ad-toolbar`'s own `input` / `select` styling
 * (`admin.css`, from `darz-studio.html:8418`), and all three share one
 * convention the request desk already set: **empty string means "no filter"**,
 * and the value handed back is `undefined` rather than `''`, so a cleared
 * filter drops out of the query string instead of being sent as blank.
 *
 * Each takes an explicit `label`. The request desk used `aria-label` on a bare
 * `<select>`; that works for a screen reader but leaves a sighted person
 * reading the option text to guess what the control filters. A visible label is
 * the mechanics change — the filters and their values are the old panel's.
 */
import type { ReactNode } from 'react';
import '../admin.css';

export interface FilterChoice {
  value: string;
  label: string;
}

export function SelectFilter({
  label,
  value,
  onChange,
  choices,
  /** The "no filter" option's wording — "All kinds", "All statuses", … */
  anyLabel,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  choices: readonly FilterChoice[];
  anyLabel: string;
}) {
  return (
    <label className="ad-filter">
      <span className="ad-filter-l">{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{anyLabel}</option>
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchFilter({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
}) {
  return (
    <label className="ad-filter ad-filter--grow">
      <span className="ad-filter-l">{label}</span>
      <input
        type="search"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    </label>
  );
}

export function ToggleFilter({
  label,
  checked,
  onChange,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="ad-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
