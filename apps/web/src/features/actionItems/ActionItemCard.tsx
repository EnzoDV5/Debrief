// The card for one action item: tick it off, see its owner, date and source, and edit it.
import type { ActionItem, ActionItemStatus } from '@debrief/shared';
import {
  CalendarDays,
  CalendarPlus,
  Pencil,
  Trash2,
  TriangleAlert,
  UserRoundPlus,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Initials } from '@/components/ui/Initials';
import { cardChip, IconButton, NoteCardHeader, noteCardClass } from '@/components/ui/NoteCard';
import { AddToCalendar } from '@/features/integrations/AddToCalendar';
import { cn } from '@/lib/cn';
import { formatCalendarDate, todayDate } from '@/lib/format';
import { useUpdateActionItem } from './hooks';

export const STATUS_LABELS: Record<ActionItemStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

export function isOverdue(item: Pick<ActionItem, 'dueDate' | 'status'>, today = todayDate()) {
  return item.status !== 'done' && item.dueDate !== null && item.dueDate < today;
}

// An empty slot: dashed outline, fills in on hover.
const addChip =
  'cursor-pointer border border-dashed border-line-strong text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent';

export function ActionItemCard({
  item,
  source,
  line,
  onEdit,
  onDelete,
  active = false,
  onActiveChange,
  fixed = false,
}: {
  item: ActionItem;
  source?: ReactNode;
  line?: number | null;
  onEdit: () => void;
  onDelete: () => void;
  active?: boolean;
  onActiveChange?: (active: boolean) => void;
  // The Actions carousel: the card fills its slot (links sit at the bottom) and, to stay compact,
  // the due date moves up next to the Action tag.
  fixed?: boolean;
}) {
  const update = useUpdateActionItem();
  const done = item.status === 'done';
  const overdue = isOverdue(item);

  // A missing assignee or date is a button that opens the edit dialog, so filling the gap the AI
  // couldn't (it never guesses) is one click away.
  const dueChip = item.dueDate ? (
    <span className={cn(cardChip, overdue ? 'bg-danger-soft text-danger' : 'bg-surface-2')}>
      <CalendarDays aria-hidden="true" className="size-3.5" />
      {/* In the carousel the chip replaces the separate Overdue badge, so it says so itself. */}
      {fixed && overdue && 'Overdue · '}
      {formatCalendarDate(item.dueDate)}
    </span>
  ) : (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Add a due date to “${item.text}”`}
      className={cn(cardChip, addChip)}
    >
      <CalendarPlus aria-hidden="true" className="size-3.5" />
      Add due date
    </button>
  );

  return (
    <article
      // Lets a decision's task list jump to this card.
      id={`action-${item.id}`}
      data-active={active || undefined}
      onMouseEnter={() => onActiveChange?.(true)}
      onMouseLeave={() => onActiveChange?.(false)}
      onFocus={() => onActiveChange?.(true)}
      onBlur={() => onActiveChange?.(false)}
      className={cn(
        noteCardClass('action', active),
        fixed && 'flex h-full flex-col',
        fixed && item.needsReview && 'border-warning/50 ring-1 ring-warning/30',
      )}
    >
      {item.needsReview && !fixed && (
        <p className="-mx-4 -mt-4 mb-3 flex items-start gap-1.5 bg-warning-soft px-4 py-2 text-sm text-warning">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className={cn(fixed && 'line-clamp-2')}>
            <strong>Needs review:</strong> {item.reviewReason ?? 'Check this item.'}
          </span>
        </p>
      )}

      <NoteCardHeader
        kind="action"
        line={line}
        edited={item.editedAt !== null}
        tags={
          <>
            {fixed ? dueChip : overdue && <Badge tone="danger">Overdue</Badge>}
            {item.status === 'in_progress' && <Badge tone="accent">In progress</Badge>}
          </>
        }
        actions={
          <>
            <IconButton label={`Edit “${item.text}”`} onClick={onEdit}>
              <Pencil aria-hidden="true" className="size-4" />
            </IconButton>
            <IconButton label={`Delete “${item.text}”`} onClick={onDelete}>
              <Trash2 aria-hidden="true" className="size-4" />
            </IconButton>
          </>
        }
      />

      <div className={cn('mt-2 flex items-start gap-3', fixed && 'min-h-0 flex-1')}>
        <input
          type="checkbox"
          checked={done}
          onChange={() => update.mutate({ id: item.id, patch: { status: done ? 'todo' : 'done' } })}
          aria-label={done ? `Mark “${item.text}” as not done` : `Mark “${item.text}” as done`}
          className="mt-0.5 size-5 shrink-0 cursor-pointer accent-accent"
        />
        <div className={cn('min-w-0 flex-1', fixed && 'flex h-full flex-col')}>
          <p
            className={cn(
              'leading-snug font-semibold text-pretty',
              done && 'text-muted line-through',
            )}
          >
            {item.text}
          </p>
          {fixed && item.needsReview && (
            <p
              title={item.reviewReason ?? undefined}
              className="mt-1.5 flex min-w-0 items-start gap-1.5 text-sm text-warning"
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span className="line-clamp-3">
                <strong>Needs review:</strong> {item.reviewReason ?? 'Check this item.'}
              </span>
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {item.owner ? (
              <span className={cn(cardChip, 'bg-surface-2 pl-1 text-fg')}>
                <Initials name={item.owner} />
                <span className="sr-only">Assigned to </span>
                {item.owner}
              </span>
            ) : (
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Assign someone to “${item.text}”`}
                className={cn(cardChip, addChip)}
              >
                <UserRoundPlus aria-hidden="true" className="size-3.5" />
                Assign someone
              </button>
            )}
            {!fixed && dueChip}
          </div>
          {item.dueDateText && (
            <p className="mt-2 text-sm text-muted">Said as “{item.dueDateText}”</p>
          )}

          <div className={cn(fixed && 'mt-auto')}>
            {source && <div className="mt-3 text-sm">{source}</div>}
            <AddToCalendar item={item} />
          </div>
          {update.error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              Couldn’t save: {update.error.message}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
