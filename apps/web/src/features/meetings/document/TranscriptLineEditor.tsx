// Fix one transcript line in place. Enter saves, Escape cancels. The original upload is kept.
import type { TranscriptLine } from '@debrief/shared';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { useLineSave, type SaveLine } from './useLineSave';

export function TranscriptLineEditor({
  line,
  onSave,
  onDone,
}: {
  line: TranscriptLine;
  onSave: SaveLine;
  onDone: () => void;
}) {
  const [text, setText] = useState(line.text);
  const { save, pending, error } = useLineSave(onSave, onDone, 'text');
  const errorId = `line-${line.n}-error`;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (text.trim() === line.text) return onDone();
    void save({ text });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') onDone();
    if (event.key === 'Enter' && !event.shiftKey) submit(event);
  };

  return (
    <form onSubmit={submit} className="motion-safe:animate-step-in">
      <textarea
        aria-label={`Edit line ${line.n}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        autoFocus
        value={text}
        rows={Math.min(6, Math.max(2, Math.ceil(text.length / 70)))}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={(event) => event.currentTarget.select()}
        className="w-full resize-y rounded-md border border-line-strong bg-surface px-3 py-2 text-lg leading-8 text-fg shadow-card outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 aria-invalid:border-danger sm:text-xl"
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <Button type="submit" size="sm" loading={pending}>
          Save line
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <span className="ml-auto hidden text-xs text-muted sm:inline">
          Enter to save · Esc to cancel
        </span>
      </div>
    </form>
  );
}
