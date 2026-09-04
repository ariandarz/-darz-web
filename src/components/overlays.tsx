/**
 * Overlays — Toast + Sheet.
 *
 * Ported from app.html's `.toast` (transient confirmation, factual copy) and
 * `.sheetbg`/`.sheet`/`.sheet-x` (the bottom-anchored modal used for Make an
 * Offer, Place a Bid, Request Price …). Presentation only — open/close state
 * and timers are owned by the caller (or a later `useToast()` / `useSheet()`).
 */
import { useEffect, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';

/* ---- Toast ---------------------------------------------------------- */
export interface ToastProps {
  message: ReactNode;
  open: boolean;
  /** ms before it auto-dismisses; 0 disables. Default 2600. */
  duration?: number;
  onClose?: () => void;
}
export function Toast({ message, open, duration = 2600, onClose }: ToastProps) {
  useEffect(() => {
    if (!open || !duration) return;
    const t = setTimeout(() => onClose?.(), duration);
    return () => clearTimeout(t);
  }, [open, duration, onClose]);

  return (
    <div className={cx('toast', open && 'show')} role="status" aria-live="polite">
      {message}
    </div>
  );
}

/* ---- Sheet -------------------------------------------------------- */
export interface SheetProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** the small cyan→magenta seam above the title (offer / confirm sheets) */
  seam?: boolean;
  children: ReactNode;
}
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  seam = false,
  className,
  children,
  ...rest
}: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div
      className={cx('sheetbg', open && 'show')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cx('sheet', className)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        {...rest}
      >
        <button type="button" className="sheet__x" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {seam && <div className="dz-seamline" />}
        {title && <h3>{title}</h3>}
        {subtitle && <p className="sheet__sub">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
