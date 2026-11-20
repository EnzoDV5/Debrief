import { CircleAlert } from 'lucide-react';
import { useId, type ReactNode } from 'react';

/** The props a control needs so screen readers announce its label, hint and error. */
export type FieldControlProps = {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
};

type FieldProps = {
  label: string;
  hint?: ReactNode;
  error?: string;
  /**
   * Keep one line of space for the hint/error even when there's none, so a message appearing
   * never pushes the rest of the form down (the sign-in forms use this).
   */
  reserveMessage?: boolean;
  /** Render prop: spread the given props onto the input so everything is wired up. */
  children: (control: FieldControlProps) => ReactNode;
};

/**
 * Label + control + hint + inline error, correctly linked:
 *   <Field label="Email" error={errors.email?.message}>
 *     {(control) => <Input {...control} {...register('email')} />}
 *   </Field>
 */
export function Field({ label, hint, error, reserveMessage = false, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  // Points at the message actually on screen (an error replaces the hint).
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
      {/* Reserved: always exactly one line tall (text-sm), empty or not. */}
      {reserveMessage ? <div className="min-h-5.25">{message}</div> : message}
    </div>
  );
}
