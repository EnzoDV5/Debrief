// Saves a fix to one transcript line and keeps its busy state and error, whether the fix goes to
// the server (a saved meeting) or into the draft (the check step before saving).
import type { LinePatch } from '@debrief/shared';
import { useState } from 'react';
import { ApiError } from '@/api/client';

export type SaveLine = (patch: LinePatch) => Promise<unknown>;

export function useLineSave(onSave: SaveLine, onDone: () => void, field: keyof LinePatch) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const save = async (patch: LinePatch) => {
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      await onSave(patch);
      onDone();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.fields?.[field] ?? err.message)
          : err instanceof Error
            ? err.message
            : 'Something went wrong',
      );
    } finally {
      setPending(false);
    }
  };
  return { save, pending, error };
}
