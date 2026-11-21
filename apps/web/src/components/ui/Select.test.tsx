// Select: opens a styled list, works with mouse and keyboard, and names itself for screen readers.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Select } from './Select';

const options = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

function Harness() {
  const [value, setValue] = useState('todo');
  return <Select label="Status" value={value} onChange={setValue} options={options} />;
}

describe('Select', () => {
  it('is named by its label and current value, and picks an option with the mouse', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const button = screen.getByRole('button', { name: 'Status, To do' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(screen.getByRole('option', { name: 'To do' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('option', { name: 'Done' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Status, Done' })).toHaveFocus();
  });

  it('works from the keyboard: arrows, Enter, typing a letter and Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    screen.getByRole('button', { name: /Status/ }).focus();

    await user.keyboard('{ArrowDown}');
    const list = screen.getByRole('listbox', { name: 'Status' });
    expect(list).toHaveFocus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByRole('button', { name: 'Status, In progress' })).toBeInTheDocument();

    await user.keyboard('{Enter}');
    await user.keyboard('d{Enter}');
    expect(screen.getByRole('button', { name: 'Status, Done' })).toBeInTheDocument();

    await user.keyboard('{Enter}{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Status, Done' })).toHaveFocus();
  });
});
