/**
 * The form and button primitives — `Button`, `Input`, `Textarea`, `Pill`,
 * `Avatar`.
 *
 * These are thin, so the cases below are deliberately narrow: they cover the
 * decisions each one makes, and nothing else. Two are worth the ink because
 * CLAUDE.md's "extend it rather than bypass it" rule depends on them holding —
 * the field's label/id wiring (a screen that bypasses `Input` loses it, which
 * is how the first `LoginPage` ended up unbranded) and the error/hint
 * precedence.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar, Button, Input, Pill, Textarea } from './primitives';

describe('Button', () => {
  it('is a real button of type button by default — never a form submit', () => {
    // The default matters: these sit inside forms all over the admin panel,
    // and a stray `type="submit"` submits on click.
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
  });

  it('honours an explicit submit', () => {
    render(<Button type="submit">Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'submit');
  });

  it('carries the variant and block classes', () => {
    render(
      <Button variant="outline" block>
        Cancel
      </Button>,
    );
    const b = screen.getByRole('button', { name: 'Cancel' });
    expect(b.className).toContain('btn');
    expect(b.className).toContain('outline');
    expect(b.className).toContain('block');
  });

  it('uses the detail page’s own class for act-primary, not .btn', () => {
    render(<Button variant="act-primary">Buy now</Button>);
    const b = screen.getByRole('button', { name: 'Buy now' });
    expect(b.className).toContain('act-primary');
    expect(b.className).not.toContain('btn');
  });

  it('keeps a caller class alongside its own', () => {
    render(<Button className="qrev-btn">Send</Button>);
    const b = screen.getByRole('button', { name: 'Send' });
    expect(b.className).toContain('btn');
    expect(b.className).toContain('qrev-btn');
  });
});

describe('Input', () => {
  it('wires the label to the field by name when no id is given', () => {
    // This is the whole reason to use the component instead of a raw <input>:
    // clicking the label focuses the field, and a screen reader names it.
    render(<Input label="Email" name="email" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('name', 'email');
  });

  it('prefers an explicit id over the name', () => {
    render(<Input label="Email" name="email" id="q-email" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'q-email');
  });

  it('marks itself invalid and shows the error', () => {
    render(<Input label="Key" name="key" error="That key is not recognised." />);
    expect(screen.getByLabelText('Key')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('That key is not recognised.')).toBeInTheDocument();
  });

  it('shows the error INSTEAD of the hint, not both', () => {
    render(
      <Input label="Key" name="key" hint="Sent to you by Darz." error="Not recognised." />,
    );
    expect(screen.getByText('Not recognised.')).toBeInTheDocument();
    expect(screen.queryByText('Sent to you by Darz.')).toBeNull();
  });

  it('is not marked invalid when it is merely hinted', () => {
    render(<Input label="Key" name="key" hint="Sent to you by Darz." />);
    expect(screen.getByLabelText('Key')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByText('Sent to you by Darz.')).toBeInTheDocument();
  });

  it('flags the control when it carries a trailing adornment', () => {
    // `.has-trailing` is what adds the right padding; without it the text
    // runs under the eye toggle.
    const { container } = render(<Input label="Key" name="key" trailing={<span>eye</span>} />);
    expect(container.querySelector('.dz-field-control')?.className).toContain('has-trailing');
  });
});

describe('Textarea', () => {
  it('wires its label the same way', () => {
    render(<Textarea label="Message" name="message" />);
    expect(screen.getByLabelText('Message').tagName).toBe('TEXTAREA');
  });
});

describe('Pill', () => {
  it('reports its selected state to assistive tech, not just in CSS', () => {
    render(<Pill selected>Painting</Pill>);
    const p = screen.getByRole('button', { name: 'Painting' });
    expect(p.className).toContain('on');
    expect(p).toHaveAttribute('aria-pressed', 'true');
  });

  it('is explicitly unpressed when selected={false}', () => {
    render(<Pill selected={false}>Sculpture</Pill>);
    expect(screen.getByRole('button', { name: 'Sculpture' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('is NOT a toggle at all when `selected` is omitted', () => {
    // Deliberate, and worth pinning: `aria-pressed={undefined}` makes React
    // drop the attribute, so a Pill used as a plain chip announces as a
    // button rather than as an un-pressed toggle. Forcing "false" here would
    // tell a screen-reader user that every decorative chip is a filter they
    // can switch on.
    render(<Pill>Sculpture</Pill>);
    expect(screen.getByRole('button', { name: 'Sculpture' })).not.toHaveAttribute(
      'aria-pressed',
    );
  });
});

describe('Avatar', () => {
  it('falls back to initials when there is no image', () => {
    render(<Avatar name="Ada Lovelace" />);
    expect(screen.getByText('AL')).toBeInTheDocument();
  });

  it('copes with a single-word name', () => {
    render(<Avatar name="Darz" />);
    expect(screen.getByText('D')).toBeInTheDocument();
  });
});
