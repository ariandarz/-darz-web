/**
 * Dropdown — the Market App's custom select (`dzSel`, app.html v619): a
 * styled trigger (`.dzsel-btn` with the value + a chevron) over a floating
 * panel (`.dzsel-pop`) of `.dzsel-opt` rows, the chosen one carrying a tick.
 * COMPONENTS.md § Toolbar: "custom dropdown: trigger 16px · padding 9px 11px ·
 * radius 10px · chevron right; panel charcoal with per-option tick".
 *
 * Behaviour ported from `DZ.selToggle` / `DZ.selPick`: tap toggles, picking
 * closes, an outside tap (capture-phase document listener) or Escape closes.
 * Used by the catalogue toolbar (sort, currency), the records tools and the
 * profile's language field. Keyboard: the trigger is a real button, options
 * are real buttons, so Tab/Enter work without extra wiring.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '../lib/cx';

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  /** shown when `value` matches no option (app.html `ph`, default "Select…") */
  placeholder?: string;
  /** accessible name for the trigger */
  label?: string;
  className?: string;
  disabled?: boolean;
}

const CHEVRON = (
  <svg
    className="dzsel-chev"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const TICK = (
  <svg
    className="dzsel-tick"
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  label,
  className,
  disabled,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const current = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // capture phase, like app.html — closes even when the tap lands on another
    // control that stops propagation
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('touchstart', onDoc, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc, true);
      document.removeEventListener('touchstart', onDoc, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className={cx('dzsel', open && 'open', className)}>
      <button
        type="button"
        className={cx('dzsel-btn', !current && 'ph')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dzsel-val">{current ? current.label : placeholder}</span>
        {CHEVRON}
      </button>
      <div className="dzsel-pop" id={listId} role="listbox" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="option"
            aria-selected={o.value === value}
            className={cx('dzsel-opt', o.value === value && 'on')}
            onClick={() => {
              onChange(o.value);
              setOpen(false);
            }}
          >
            <span>{o.label}</span>
            {TICK}
          </button>
        ))}
      </div>
    </div>
  );
}
