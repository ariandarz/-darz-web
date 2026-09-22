/**
 * `Dropdown` — the Market App's custom select (`dzSel`, app.html v619).
 *
 * This is the shared component with the most behaviour that nothing else
 * checks: the E2E walks click it and read the result, so they prove it works
 * on the happy path, but not WHY it closes — and the closing rules are the
 * part that was carefully ported. The capture-phase document listener exists
 * because the old app needed the panel to close even when the tap lands on a
 * control that stops propagation, and that is invisible to a test that only
 * clicks options.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dropdown } from './Dropdown';

const OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'fa', label: 'Farsi' },
  { value: 'fr', label: 'French' },
];

function setup(props: Partial<React.ComponentProps<typeof Dropdown>> = {}) {
  const onChange = vi.fn();
  render(
    <Dropdown
      options={OPTIONS}
      value={props.value ?? ''}
      onChange={props.onChange ?? onChange}
      label="Language"
      {...props}
    />,
  );
  return { onChange, trigger: screen.getByRole('button', { name: 'Language' }) };
}

describe('what the trigger shows', () => {
  it('shows the placeholder, marked as such, when nothing is chosen', () => {
    const { trigger } = setup();
    expect(trigger).toHaveTextContent('Select…');
    // `.ph` is what greys it — a placeholder that looked like a value would
    // read as "English is selected".
    expect(trigger.className).toContain('ph');
  });

  it('shows the chosen option label, not its value', () => {
    const { trigger } = setup({ value: 'fa' });
    expect(trigger).toHaveTextContent('Farsi');
    expect(trigger.className).not.toContain('ph');
  });

  it('falls back to the placeholder when the value matches no option', () => {
    // A stale query param or a theme-supplied value that is no longer offered.
    const { trigger } = setup({ value: 'klingon' });
    expect(trigger).toHaveTextContent('Select…');
  });
});

describe('opening and closing', () => {
  it('toggles on the trigger, and says so to assistive tech', () => {
    const { trigger } = setup();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on an outside mousedown', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on an outside touch — the mobile path, which is the primary one', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.touchStart(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes even when the outside control stops propagation', () => {
    // The whole reason the listener is registered in the CAPTURE phase
    // (`app.html` does the same). A bubble-phase listener never sees this.
    const outside = document.createElement('button');
    outside.addEventListener('mousedown', (e) => e.stopPropagation());
    document.body.appendChild(outside);

    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.mouseDown(outside);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    outside.remove();
  });

  it('closes on Escape', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('stays open when the click lands inside it', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.mouseDown(screen.getByRole('listbox'));
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('choosing', () => {
  it('reports the value and closes', () => {
    const { trigger, onChange } = setup();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: 'Farsi' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('fa');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('marks the current option selected and no other', () => {
    const { trigger } = setup({ value: 'fr' });
    fireEvent.click(trigger);
    const selected = screen
      .getAllByRole('option')
      .filter((o) => o.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('French');
  });

  it('still reports a re-pick of the current value', () => {
    // The caller decides whether that is a no-op; swallowing it here would
    // make a "confirm" interaction impossible to build on this component.
    const { trigger, onChange } = setup({ value: 'fa' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: 'Farsi' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('fa');
  });
});

describe('disabled', () => {
  it('does not open', () => {
    const { trigger } = setup({ disabled: true });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('cleanup', () => {
  it('removes its document listeners when it unmounts while open', () => {
    // An open dropdown that unmounts (a sheet closing, a route change) used to
    // be the classic leak here: the capture listener outlives the component
    // and fires setState on an unmounted tree.
    const remove = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(
      <Dropdown options={OPTIONS} value="" onChange={vi.fn()} label="Language" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Language' }));
    unmount();
    const removed = remove.mock.calls.map((c) => c[0]);
    expect(removed).toEqual(expect.arrayContaining(['mousedown', 'touchstart', 'keydown']));
    remove.mockRestore();
  });
});
