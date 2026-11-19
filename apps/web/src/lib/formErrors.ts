import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/api/client';

/**
 * Shows an api error in a form: messages for known fields go under those inputs (the server is
 * the real validator), anything else becomes the form-level message in `errors.root.server`.
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldNames: readonly Path<T>[],
) {
  if (error instanceof ApiError && error.fields) {
    let matched = false;
    for (const name of fieldNames) {
      const message = error.fields[name];
      if (message) {
        setError(name, { type: 'server', message }, { shouldFocus: !matched });
        matched = true;
      }
    }
    if (matched) return;
  }
  const message = error instanceof Error ? error.message : 'Something went wrong';
  setError('root.server', { type: 'server', message });
}
