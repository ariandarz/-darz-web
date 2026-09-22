/**
 * `Segment` — the bordered view switch (`.viewseg`, app.html:1393): the
 * catalogue's [grid | Single view] and the records' [Cards | List].
 *
 * Small, but it is a **toggle group**, and the thing worth pinning is that it
 * says so: exactly one button pressed at a time, reported through
 * `aria-pressed` rather than only through the `.on` class that draws the
 * underline. A switch that is styled-only leaves a screen-reader user with two
 * identical buttons and no way to tell which view they are in.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Segment } from './Segment';

const OPTIONS = [
  { value: 'grid' as const, content: 'Grid', title: 'Grid view' },
  { value: 'single' as const, content: 'Single', title: 'One work per page' },
];

function setup(value: 'grid' | 'single' = 'grid') {
  const onChange = vi.fn();
  render(<Segment options={OPTIONS} value={value} onChange={onChange} label="View" />);
  return { onChange };
}

it('is a named group, so the pair reads as one control', () => {
  setup();
  expect(screen.getByRole('group', { name: 'View' })).toBeInTheDocument();
});

it('presses exactly one option, and it is the current value', () => {
  setup('single');
  const pressed = screen
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-pressed') === 'true');
  expect(pressed).toHaveLength(1);
  expect(pressed[0]).toHaveTextContent('Single');
});

it('marks the active option with the class that draws the underline', () => {
  setup('grid');
  expect(screen.getByRole('button', { name: /Grid/ }).className).toContain('on');
  expect(screen.getByRole('button', { name: /Single/ }).className).not.toContain('on');
});

it('reports the value picked', () => {
  const { onChange } = setup('grid');
  fireEvent.click(screen.getByRole('button', { name: /Single/ }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith('single');
});

it('still reports a click on the option already active', () => {
  // The caller decides whether that is a no-op; swallowing it here would make
  // a "re-apply this view" interaction impossible to build on the component.
  const { onChange } = setup('grid');
  fireEvent.click(screen.getByRole('button', { name: /Grid/ }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith('grid');
});

it('carries each option title as a tooltip', () => {
  setup();
  expect(screen.getByRole('button', { name: /Grid/ })).toHaveAttribute('title', 'Grid view');
});

it('presses nothing when the value matches no option', () => {
  // A stale query param can do this. Marking one arbitrarily would be worse
  // than marking none.
  render(
    <Segment options={OPTIONS} value={'cards' as 'grid'} onChange={vi.fn()} label="View" />,
  );
  expect(
    screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true'),
  ).toHaveLength(0);
});
