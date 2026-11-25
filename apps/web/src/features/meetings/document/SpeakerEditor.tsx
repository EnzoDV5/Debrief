// Say who spoke one transcript line, for transcripts where the name is missing or wrong.
// Pick one of the people already in the meeting from the dropdown, or type a new name.
// Enter saves, Escape cancels.
import type { TranscriptLine } from '@debrief/shared';
import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { NameCombobox } from '@/components/ui/NameCombobox';
import { useLineSave, type SaveLine } from './useLineSave';

export function SpeakerEditor({
  line,
  suggestions,
  onSave,
  onDone,
}: {
  line: TranscriptLine;
  suggestions: string[];
  onSave: SaveLine;
  onDone: () => void;
}) {
  const [name, setName] = useState(line.speaker ?? '');
  const { save, pending, error } = useLineSave(onSave, onDone, 'speaker');
  const listId = useId();
  const errorId = `line-${line.n}-speaker-error`;

  const submit = (speaker: string | null) => {
    if ((speaker?.trim() || null) === (line.speaker ?? null)) return onDone();
    void save({ speaker });
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(name);
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
        <NameCombobox
          id={`${listId}-input`}
          autoFocus
          placeholder="Name"
          value={name}
          onChange={setName}
          names={suggestions}
          listLabel="People in this meeting"
          maxLength={100}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onKeyDown={onKeyDown}
          className="w-64 max-w-full"
        />
        <Button type="submit" size="sm" loading={pending}>
          Save speaker
        </Button>
        {line.speaker && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => submit(null)}
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
