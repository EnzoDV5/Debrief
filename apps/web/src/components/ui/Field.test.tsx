// Field: labels, hints and errors are linked up for screen readers.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';
import { Input } from './Input';

describe('Field', () => {
  it('links the label, hint and error to the input for screen readers', () => {
    const { rerender } = render(
      <Field label="Email" hint="We never share it">
        {(control) => <Input {...control} />}
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAccessibleDescription('We never share it');
    expect(input).toHaveAttribute('aria-invalid', 'false');

    rerender(
      <Field label="Email" hint="We never share it" error="Enter a valid email address">
        {(control) => <Input {...control} />}
      </Field>,
    );
    expect(input).toHaveAccessibleDescription('Enter a valid email address');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
