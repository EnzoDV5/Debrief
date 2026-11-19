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
  /** Render prop: spread the given props onto the input so everything is wired up. */
  children: (control: FieldControlProps) => ReactNode;
};

/**
 * Label + control + hint + inline error, correctly linked:
 *   <Field label="Email" error={errors.email?.message}>
 *     {(control) => <Input {...control} {...register('email')} />}
 *   </Field>
 */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-fg">
        {label}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
