// A labelled form field with a hint or error underneath, wired up for screen readers.
import { CircleAlert } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type FieldControlProps = {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
};

type FieldProps = {
  label: string;
  hint?: ReactNode;
  error?: string;
  reserveMessage?: boolean;
  // Adds "(optional)" after the label, so the user knows they can leave it empty.
  optional?: boolean;
  // 'bar': the field sits in the dark top bar on wide screens, so its text is light there.
  tone?: 'default' | 'bar';
  children: (control: FieldControlProps) => ReactNode;
};

export function Field({
  label,
  hint,
  error,
  reserveMessage = false,
  optional = false,
  tone = 'default',
  children,
}: FieldProps) {
  const bar = tone === 'bar';
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  const message = error ? (
    <p
      id={errorId}
      className={cn(
        'flex items-start gap-1.5 text-sm font-medium text-danger',
        bar && 'lg:text-danger-light',
      )}
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {error}
    </p>
  ) : hint ? (
    <p id={hintId} className={cn('text-sm text-muted', bar && 'lg:text-sidebar-muted')}>
      {hint}
    </p>
  ) : null;

  return (
    <div className="space-y-1.5">
      <label
        // An id too, for controls that build their name from it (DatePicker: label + date).
        id={`${id}-label`}
        htmlFor={id}
        className={cn('block text-sm font-semibold text-fg', bar && 'lg:text-sidebar-strong')}
      >
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {reserveMessage ? <div className="min-h-5.25">{message}</div> : message}
    </div>
  );
}
