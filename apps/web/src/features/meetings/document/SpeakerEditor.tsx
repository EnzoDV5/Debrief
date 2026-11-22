// Say who spoke one transcript line, for transcripts where the name is missing or wrong.
// Suggests the names already in the meeting. Enter saves, Escape cancels.
import type { TranscriptLine } from '@debrief/shared';
import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { useUpdateTranscriptLine } from '../hooks';

export function SpeakerEditor({
  meetingId,
  line,
  suggestions,
  onDone,
}: {
  meetingId: string;
  line: TranscriptLine;
  suggestions: string[];
  onDone: () => void;
}) {
  const [name, setName] = useState(line.speaker ?? '');
  const update = useUpdateTranscriptLine(meetingId);
  const listId = useId();
  const fieldError = update.error instanceof ApiError ? update.error.fields?.speaker : undefined;
  const error = fieldError ?? update.error?.message;
  const errorId = `line-${line.n}-speaker-error`;

  const save = (speaker: string | null) => {
    if (update.isPending) return;
    if ((speaker?.trim() || null) === (line.speaker ?? null)) return onDone();
    update.mutate({ n: line.n, speaker }, { onSuccess: onDone });
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save(name);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') onDone();
  };

  return (
    <form onSubmit={onSubmit} className="mb-2 motion-safe:animate-step-in">
      <label htmlFor={`${listId}-input`} className="text-sm font-semibold">
        Who said line {line.n}?
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <input
          id={`${listId}-input`}
          list={listId}
          autoFocus
          autoComplete="off"
          placeholder="Name"
          value={name}
          maxLength={100}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={onKeyDown}
          className="min-h-9 w-56 max-w-full rounded-md border border-line-strong bg-surface px-3 text-base text-fg shadow-card outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 aria-invalid:border-danger"
        />
        <datalist id={listId}>
          {suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
        <Button type="submit" size="sm" loading={update.isPending}>
          Save speaker
        </Button>
        {line.speaker && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={update.isPending}
            onClick={() => save(null)}
          >
            Remove
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
