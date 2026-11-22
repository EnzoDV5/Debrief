// DatePicker: picking with the mouse and keyboard, months, shortcuts, clearing and closing.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { addDays, DatePicker, dueDateShortcuts } from './DatePicker';
import { Field } from './Field';

function Harness({
  initial = '2026-11-25',
  onPick,
}: {
  initial?: string;
  onPick?: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Field label="Due date">
      {(control) => (
        <DatePicker
          {...control}
          value={value}
          onChange={(next) => {
            setValue(next);
            onPick?.(next);
          }}
          shortcuts={[{ label: 'Christmas', value: '2026-12-25' }]}
          clearable
        />
      )}
    </Field>
  );
}

describe('DatePicker', () => {
  it('shows the date in words and is named by its label and the date', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Due date Wed, 25 Nov 2026' })).toBeInTheDocument();
  });

  it('opens on the chosen month and picks a day with the mouse', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^Due date/ }));

    expect(screen.getByRole('grid', { name: 'November 2026' })).toBeInTheDocument();
    const chosen = screen.getByRole('button', { name: 'Wednesday, 25 November 2026' });
    expect(chosen).toHaveAttribute('aria-pressed', 'true');
    expect(chosen).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Friday, 27 November 2026' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Due date/ })).toHaveTextContent('Fri, 27 Nov 2026');
    expect(screen.getByRole('button', { name: /^Due date/ })).toHaveFocus();
  });

  it('moves with the keyboard: days, weeks and months, then Enter picks', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^Due date/ }));

    await user.keyboard('{ArrowRight}{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Thursday, 3 December 2026' })).toHaveFocus();
    expect(screen.getByRole('grid', { name: 'December 2026' })).toBeInTheDocument();
    await user.keyboard('{PageUp}{Home}');
    expect(screen.getByRole('button', { name: 'Monday, 2 November 2026' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: /^Due date/ })).toHaveTextContent('Mon, 2 Nov 2026');
  });

  it('changes month with the arrows, keeps the day where it can', async () => {
    const user = userEvent.setup();
    render(<Harness initial="2027-01-31" />);
    await user.click(screen.getByRole('button', { name: /^Due date/ }));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    // 31 January + 1 month is the last day of February.
    expect(screen.getByRole('grid', { name: 'February 2027' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('grid', { name: 'December 2026' })).toBeInTheDocument();
  });

  it('picks a shortcut, clears, and closes on Escape without picking', async () => {
    const picked: string[] = [];
    const user = userEvent.setup();
    render(<Harness onPick={(v) => picked.push(v)} />);
    const field = screen.getByRole('button', { name: /^Due date/ });

    await user.click(field);
    await user.click(screen.getByRole('button', { name: 'Christmas' }));
    expect(field).toHaveTextContent('Fri, 25 Dec 2026');

    await user.click(field);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(field).toHaveFocus();

    await user.click(field);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(field).toHaveTextContent('Pick a date');
    expect(picked).toEqual(['2026-12-25', '']);
  });

  it('offers today, tomorrow and next Monday for due dates', () => {
    // 2026-11-25 is a Wednesday.
    expect(dueDateShortcuts('2026-11-25')).toEqual([
      { label: 'Today', value: '2026-11-25' },
      { label: 'Tomorrow', value: '2026-11-26' },
      { label: 'Next Monday', value: '2026-11-30' },
    ]);
    // On a Monday, "next Monday" is a week later, not today.
    expect(dueDateShortcuts('2026-11-30')[2]).toEqual({
      label: 'Next Monday',
      value: '2026-12-07',
    });
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
