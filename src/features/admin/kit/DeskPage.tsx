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
  subtitle,
  strip,
  action,
  toolbar,
  wide = false,
  children,
}: {
  title: ReactNode;
  /**
   * The old panel's line under the heading — `<div class="sub">` inside the
   * desk's head block, e.g. Market Sales at `darz-studio.html:12570`.
   *
   * It is a **slot** rather than something a desk writes into `children`, and
   * that is the whole point: `.ad-desksub` carries `margin-top: -12px` to sit
   * tight under the heading, which only reads correctly when nothing is
   * between them. A desk writing it as its first child put it AFTER the
   * toolbar — so on the fourteen desks that have both, the line rendered
   * under the filters with its negative margin pulling it into them, instead
   * of under the heading where the old panel puts it. Found 2026-09-22 by
   * screenshotting Market Sales against `15-market-sales`; invisible in
   * source, and exactly the class of miss CLAUDE.md rule 5 exists for.
   */
  subtitle?: ReactNode;
  /**
   * The desk's overview strip — the row of count tiles several desks open
   * with (`.ad-tiles`).
   *
   * A slot for the same reason `subtitle` is one, and found the same way:
   * the old panel puts the strip **between the sub-line and the filter bar**,
   * every time it has one — Market Sales (`dzs-head` → `dzs-stats` →
   * `dzs-bar`), Market App, Memberships, Collectors. A desk writing it as its
   * first child put it AFTER the toolbar, so on all four of this port's
   * strip-carrying desks you filtered first and read the totals second.
   * Found 2026-09-22 against `06-market-published`.
   *
   * **Accounting is the exception and must stay one.** Its old desk
   * (`31-accounting`) runs sub-line → filters → totals → quick-add, because
   * those totals are *scoped by* the filters above them — month, category,
   * person, status — so reading them before setting the filter would be
   * reading the wrong number. It keeps its tiles in `children`, after its own
   * filter row, and should not be moved into this slot.
   */
  strip?: ReactNode;
  /** The desk's primary action, if it has one — rendered beside the heading. */
  action?: ReactNode;
  /** Filters: see `filters.tsx`. Omitted entirely when a desk has none. */
  toolbar?: ReactNode;
  /**
   * Let the desk use the screen (**G-1**, approved 2026-09-21).
   *
   * `.ad-page` is a 1040px centred column, inherited from the collector app's
   * page shell — which is right for a form and wrong for a table. The old
   * panel is a full-width workspace, and the audit found this the single
   * largest visual divergence from it: the Artworks Database has 13 columns
   * and a column chooser, and it was scrolling horizontally inside a card on
   * a 1440px screen with room to spare.
   *
   * So: **tables get the room, editors keep the column.** Reading a form at
   * 1600px is worse, not better — the eye loses the line — which is why this
   * is a per-desk choice and not a change to `.ad-page` itself.
   */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`dz-page ad-page${wide ? ' ad-page--wide' : ''}`}>
      <div className="ad-head">
        <h1 className="ad-h">{title}</h1>
        {action}
      </div>
      {subtitle && <p className="ad-desksub">{subtitle}</p>}
      {strip}
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
