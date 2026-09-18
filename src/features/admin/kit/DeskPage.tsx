/**
 * DeskPage — every admin desk's outer shape: heading, an optional action beside
 * it, an optional toolbar of filters, and the body.
 *
 * Generalised from the request desk, which had `<div className="dz-page ad-page">
 * <h1 className="ad-h">…` inline. A desk never writes that shell again, which is
 * what keeps fifteen desks looking like one panel instead of fifteen pages.
 *
 * `.ad-h` and `.ad-toolbar` are the old panel's own classes (`darz-studio.html`
 * `:9104`, `:8418`); `.ad-head` is new, because the old panel puts a desk's
 * primary action in the global header (`＋ New`, `:11106`) and this app does
 * not have that header button — a desk owns its own action instead. That is a
 * mechanics change, not a content one: same action, same copy, placed where a
 * per-route app can put it.
 */
import type { ReactNode } from 'react';
import '../admin.css';

export function DeskPage({
  title,
  action,
  toolbar,
  children,
}: {
  title: ReactNode;
  /** The desk's primary action, if it has one — rendered beside the heading. */
  action?: ReactNode;
  /** Filters: see `filters.tsx`. Omitted entirely when a desk has none. */
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="dz-page ad-page">
      <div className="ad-head">
        <h1 className="ad-h">{title}</h1>
        {action}
      </div>
      {toolbar && <div className="ad-toolbar">{toolbar}</div>}
      {children}
    </div>
  );
}

/** A desk's primary action — the old panel's `＋ New` shape (`:11107`), as a
 * desk-owned control. */
export function DeskAction({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="ad-action" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/** The banner `deskBanner()` decides on — a failed load or a failed row action,
 * shown without taking the table away. */
export function DeskBanner({ children }: { children: ReactNode }) {
  return (
    <p className="dz-state err" role="alert">
      {children}
    </p>
  );
}
