// The transcript on the check step, before anything is saved: drawn like the meeting page, and
// each line can have its words fixed or its speaker set, so the AI reads the corrected version.
import type { LinePatch, TranscriptLine } from '@debrief/shared';
import { Pencil, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { LineEditBadges } from './document/LineEditBadges';
import { SpeakerEditor } from './document/SpeakerEditor';
import { TranscriptLineEditor } from './document/TranscriptLineEditor';

type Part = 'text' | 'speaker';

export function ReviewTranscript({
  lines,
  speakers,
  onSave,
}: {
  lines: TranscriptLine[];
  // Names already in the transcript, offered when you say who spoke a line.
  speakers: string[];
  // Throws with a message when the fix isn't allowed (an empty line, say).
  onSave: (n: number, patch: LinePatch) => Promise<void>;
}) {
  const [editing, setEditing] = useState<{ n: number; part: Part } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  // When an editor closes, keyboard focus goes back to the button that opened it.
  const closed = useRef<{ n: number; part: Part } | null>(null);
  useEffect(() => {
    if (editing || !closed.current) return;
    const { n, part } = closed.current;
    closed.current = null;
    listRef.current
      ?.querySelector<HTMLButtonElement>(`button[data-line="${n}"][data-part="${part}"]`)
      ?.focus();
  }, [editing]);
  const close = () => {
    closed.current = editing;
    setEditing(null);
  };

  return (
    <ol ref={listRef} className="pt-3">
      {lines.map((line, i) => {
        const newSpeaker = line.speaker && line.speaker !== lines[i - 1]?.speaker;
        const part = editing?.n === line.n ? editing.part : null;
        return (
          <li
            key={line.n}
            className={cn(
              'group grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 px-4 py-2.5 sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:px-8',
              newSpeaker && i > 0 && 'pt-7',
            )}
          >
            <span
              aria-hidden="true"
              className="pt-0.5 text-right font-mono text-xs text-muted tabular-nums"
            >
              {line.n}
            </span>
            <div className="min-w-0">
              {part === 'speaker' ? (
                <SpeakerEditor
                  line={line}
                  suggestions={speakers}
                  onSave={(patch) => onSave(line.n, patch)}
                  onDone={close}
                />
              ) : (
                newSpeaker && <p className="mb-1 text-base font-bold text-fg">{line.speaker}</p>
              )}
              {part === 'text' ? (
                <TranscriptLineEditor
                  line={line}
                  onSave={(patch) => onSave(line.n, patch)}
                  onDone={close}
                />
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-lg leading-8 wrap-break-word text-fg/90 sm:text-xl sm:leading-9">
                      {line.text}
                    </p>
                    {/* Shown on hover or keyboard focus; always there on touch screens. */}
                    <div className="flex shrink-0 gap-0.5 pt-0.5 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0">
                      <LineButton
                        line={line.n}
                        part="text"
                        label={`Edit line ${line.n}`}
                        onClick={() => setEditing({ n: line.n, part: 'text' })}
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </LineButton>
                      <LineButton
                        line={line.n}
                        part="speaker"
                        label={
                          line.speaker
                            ? `Change who said line ${line.n}`
                            : `Add a speaker to line ${line.n}`
                        }
                        onClick={() => setEditing({ n: line.n, part: 'speaker' })}
                      >
                        <UserRound aria-hidden="true" className="size-4" />
                      </LineButton>
                    </div>
                  </div>
                  <LineEditBadges line={line} />
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function LineButton({
  line,
  part,
  label,
  onClick,
  children,
}: {
  line: number;
  part: Part;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-line={line}
      data-part={part}
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
    >
      {children}
    </button>
  );
}
