// The card for one decision, with the tasks that put it into action: tick them off, jump to
// their cards, or add one. A decision nobody is acting on says so.
import type { ActionItem, Decision, Meeting } from '@debrief/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { AnimatedHeight } from '@/components/ui/AnimatedHeight';
import { Button } from '@/components/ui/Button';
import { Initials } from '@/components/ui/Initials';
import { Input } from '@/components/ui/Input';
import {
  IconButton,
  NoteCardHeader,
  isOverdue,
  noteCardClass,
} from '@/features/actionItems/ActionItemCard';
import { ActionItemDialog } from '@/features/actionItems/ActionItemDialog';
import {
  useDeleteDecision,
  useUpdateActionItem,
  useUpdateDecision,
} from '@/features/actionItems/hooks';
import { useLingering } from '@/lib/useLingering';
import { cn } from '@/lib/cn';
import { formatShortCalendarDate } from '@/lib/format';

export function DecisionBubble({
  meeting,
  decision,
  tasks = [],
  ownerSuggestions = [],
  onJumpToTask,
  active = false,
  onActiveChange,
}: {
  meeting: Meeting;
  decision: Decision;
  // This meeting's action items linked to this decision.
  tasks?: ActionItem[];
  ownerSuggestions?: string[];
  onJumpToTask?: (item: ActionItem) => void;
  active?: boolean;
  onActiveChange?: (active: boolean) => void;
}) {
  const update = useUpdateDecision(meeting.id);
  const remove = useDeleteDecision(meeting.id);
  const [draft, setDraft] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // Keeps the dialog mounted while it animates out.
  const shownAdding = useLingering(adding || null);
  const doneCount = tasks.filter((task) => task.status === 'done').length;

  return (
    <article
      onMouseEnter={() => onActiveChange?.(true)}
      onMouseLeave={() => onActiveChange?.(false)}
      onFocus={() => onActiveChange?.(true)}
      onBlur={() => onActiveChange?.(false)}
      data-active={active || undefined}
      className={noteCardClass('decision', active)}
    >
      <NoteCardHeader
        kind="decision"
        line={decision.sourceLine}
        edited={decision.editedAt !== null}
        actions={
          draft === null && (
            <>
              <IconButton
                label={`Edit decision “${decision.text}”`}
                onClick={() => setDraft(decision.text)}
              >
                <Pencil aria-hidden="true" className="size-4" />
              </IconButton>
              <IconButton
                label={`Delete decision “${decision.text}”`}
                onClick={() => remove.mutate(decision.id)}
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </IconButton>
            </>
          )
        }
      />

      {draft === null ? (
        <p className="mt-2 leading-snug font-semibold text-pretty">{decision.text}</p>
      ) : (
        <form
          className="mt-2 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            update.mutate({ id: decision.id, text: draft }, { onSuccess: () => setDraft(null) });
          }}
        >
          <Input
            aria-label="Decision"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoFocus
          />
          {update.error && <Alert tone="danger">{update.error.message}</Alert>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={update.isPending}>
              Save
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <section
        aria-label={`Tasks for “${decision.text}”`}
        className="mt-3 border-t border-line pt-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold tracking-label text-muted uppercase">
            Tasks
            {tasks.length > 0 && (
              <span className="ml-1.5 font-medium normal-case tabular-nums">
                {doneCount}/{tasks.length} done
              </span>
            )}
          </h4>
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label={`Add a task for “${decision.text}”`}
            className="-mr-1.5 inline-flex min-h-8 items-center gap-1 rounded-pill px-2.5 text-sm font-semibold text-success transition-colors hover:bg-success-soft"
          >
            <Plus aria-hidden="true" className="size-4" />
            Add task
          </button>
        </div>

        {/* Grows and shrinks smoothly as tasks are linked, added or removed. */}
        <AnimatedHeight>
          {tasks.length === 0 ? (
            <p className="mt-1.5 text-sm text-muted">
              No tasks yet. Add one so this decision doesn’t get forgotten.
            </p>
          ) : (
            <ul className="mt-1.5 space-y-0.5">
              {tasks.map((task) => (
                <DecisionTask key={task.id} task={task} onJump={() => onJumpToTask?.(task)} />
              ))}
            </ul>
          )}
        </AnimatedHeight>
      </section>

      {remove.error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          Couldn’t delete: {remove.error.message}
        </p>
      )}

      {shownAdding && (
        <ActionItemDialog
          open={adding}
          onClose={() => setAdding(false)}
          meetingId={meeting.id}
          ownerSuggestions={ownerSuggestions}
          decisions={meeting.decisions}
          initialDecisionId={decision.id}
          // The new task sits beside the decision's line in the transcript.
          source={
            decision.sourceLine !== null ? { line: decision.sourceLine, quote: null } : undefined
          }
          transcriptLine={meeting.transcriptLines.find((line) => line.n === decision.sourceLine)}
        />
      )}
    </article>
  );
}

function DecisionTask({ task, onJump }: { task: ActionItem; onJump: () => void }) {
  const update = useUpdateActionItem();
  const done = task.status === 'done';
  const overdue = isOverdue(task);

  return (
    <li className="flex items-center gap-2.5 rounded-md py-1 motion-safe:animate-step-in">
      <input
        type="checkbox"
        checked={done}
        onChange={() => update.mutate({ id: task.id, patch: { status: done ? 'todo' : 'done' } })}
        aria-label={done ? `Mark “${task.text}” as not done` : `Mark “${task.text}” as done`}
        className="size-4 shrink-0 cursor-pointer accent-accent"
      />
      {task.owner && <Initials name={task.owner} />}
      <button
        type="button"
        onClick={onJump}
        title={`${task.owner ? `${task.owner}: ` : ''}${task.text}`}
        className={cn(
          'min-w-0 flex-1 truncate text-left text-sm transition-colors hover:text-accent hover:underline',
          done ? 'text-muted line-through' : 'text-fg',
        )}
      >
        <span className="sr-only">Show the task </span>
        {task.text}
      </button>
      {task.dueDate && (
        <span
          className={cn(
            'shrink-0 text-xs tabular-nums',
            overdue ? 'font-semibold text-danger' : 'text-muted',
          )}
        >
          {overdue && <span className="sr-only">Overdue, due </span>}
          {formatShortCalendarDate(task.dueDate)}
        </span>
      )}
    </li>
  );
}
