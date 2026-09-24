/**
 * `Sheet` — the bottom sheet every collector flow opens (offers, confirms,
 * the membership tiers).
 *
 * Three of its four ways to close are easy to break and invisible to a walk
 * that only clicks ✕: Escape, the backdrop, and the rule that a click INSIDE
 * must not close it. That last one is a one-character bug away
 * (`e.target === e.currentTarget`), and getting it wrong dismisses the sheet
 * whenever someone taps their own form.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sheet, Toast } from './overlays';

function setup(open = true) {
  const onClose = vi.fn();
  const { rerender } = render(
    <Sheet open={open} onClose={onClose} title="Make an offer">
      <button type="button">Inside</button>
    </Sheet>,
  );
  return { onClose, rerender };
}

describe('closing', () => {
  it('closes on the ✕', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape', () => {
    const { onClose } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on the backdrop', () => {
    const { onClose } = setup();
    // The backdrop is the element the dialog sits in; clicking the dialog
    // itself must not count.
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog.parentElement!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does NOT close on a click inside — the one-character bug', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Inside' }));
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores Escape while closed', () => {
    // The listener is bound only when open; a stray Escape elsewhere in the
    // app must not fire a hidden sheet's onClose.
    const { onClose } = setup(false);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores other keys', () => {
    const { onClose } = setup();
    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('what it announces', () => {
  it('is a modal dialog named by its title', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Make an offer');
  });

  it('shows the show class only when open', () => {
    const onClose = vi.fn();
    const { container, rerender } = render(
      <Sheet open={false} onClose={onClose}>
        <p>body</p>
      </Sheet>,
    );
    const backdrop = container.firstElementChild!;
    expect(backdrop.className).not.toContain('show');
    rerender(
      <Sheet open onClose={onClose}>
        <p>body</p>
      </Sheet>,
    );
    expect(backdrop.className).toContain('show');
  });

  it('renders the seam only when asked', () => {
    const { container, rerender } = render(
      <Sheet open onClose={vi.fn()}>
        <p>body</p>
      </Sheet>,
    );
    expect(container.querySelector('.dz-seamline')).toBeNull();
    rerender(
      <Sheet open seam onClose={vi.fn()}>
        <p>body</p>
      </Sheet>,
    );
    expect(container.querySelector('.dz-seamline')).not.toBeNull();
  });
});

/**
 * `Toast` — the collector app's bottom pill (`app.html:1246`).
 *
 * Its whole behaviour is one timer, and a timer has three ways to be wrong:
 * it never fires, it fires after the component is gone, or it re-arms on every
 * render and so never actually elapses. Fake timers make all three visible.
 */
describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('closes itself after the duration', () => {
    const onClose = vi.fn();
    render(<Toast message="Saved" open duration={2600} onClose={onClose} />);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2599);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('starts no timer while closed', () => {
    const onClose = vi.fn();
    render(<Toast message="Saved" open={false} onClose={onClose} />);
    vi.advanceTimersByTime(10_000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('treats duration 0 as "stays until dismissed"', () => {
    const onClose = vi.fn();
    render(<Toast message="Saved" open duration={0} onClose={onClose} />);
    vi.advanceTimersByTime(60_000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not fire after unmount', () => {
    // The leak: a toast dismissed by a route change would otherwise call back
    // into a gone component.
    const onClose = vi.fn();
    const { unmount } = render(<Toast message="Saved" open onClose={onClose} />);
    unmount();
    vi.advanceTimersByTime(10_000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('is announced politely, and only shown when open', () => {
    const { container, rerender } = render(<Toast message="Saved" open={false} />);
    const el = container.firstElementChild!;
    expect(el).toHaveAttribute('role', 'status');
    expect(el).toHaveAttribute('aria-live', 'polite');
    expect(el.className).not.toContain('show');
    rerender(<Toast message="Saved" open />);
    expect(el.className).toContain('show');
  });

  it('survives having no onClose at all', () => {
    render(<Toast message="Saved" open duration={100} />);
    expect(() => vi.advanceTimersByTime(200)).not.toThrow();
  });
});
