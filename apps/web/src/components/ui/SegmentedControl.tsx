import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Option<T extends string> = { value: T; label: string; icon?: ReactNode };

/**
 * A pill switch between a few options ("Paste text" / "Upload a file").
 * Built from real radio buttons, so arrow keys, screen readers and forms all work natively;
 * the inputs are visually hidden and the labels are styled instead.
 */
export function SegmentedControl<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="inline-flex w-full rounded-md bg-surface-2 p-1 ring-1 ring-line ring-inset sm:w-auto">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'relative flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-sm px-4 text-sm font-semibold transition-colors sm:flex-none',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
              value === option.value
                ? 'bg-surface text-fg shadow-card'
                : 'text-muted hover:text-fg',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.icon}
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
