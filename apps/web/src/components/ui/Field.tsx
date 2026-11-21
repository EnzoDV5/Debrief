// A labelled form field with a hint or error underneath, wired up for screen readers.
import { CircleAlert } from 'lucide-react';
import { useId, type ReactNode } from 'react';

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
  children: (control: FieldControlProps) => ReactNode;
};

export function Field({ label, hint, error, reserveMessage = false, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  const message = error ? (
    <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {error}
    </p>
  ) : hint ? (
    <p id={hintId} className="text-sm text-muted">
      {hint}
    </p>
  ) : null;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-fg">
        {label}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {reserveMessage ? <div className="min-h-5.25">{message}</div> : message}
    </div>
  );
}
