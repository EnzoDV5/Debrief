import type { ActionItem, ActionItemStatus } from '@debrief/shared';
import { CalendarDays, Pencil, Trash2, TriangleAlert, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/Badge';
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

/**
 * One action item: tick box, task, owner, due date, review warning and where it came from.
 * Used on the meeting page and on "My open items" (which adds a link back to the meeting).
 */
export function ActionItemCard({
  item,
  source,
  onEdit,
  onDelete,
}: {
  item: ActionItem;
  /** Where it came from: "Line 6" on a meeting page, the meeting's name on "My open items". */
  source?: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const update = useUpdateActionItem();
  const done = item.status === 'done';
  const overdue = isOverdue(item);

  return (
    <article
      className={cn(
        'rounded-md border p-4 transition-colors',
        item.needsReview ? 'border-warning/40 bg-warning-soft/30' : 'border-line bg-surface',
      )}
    >
      <div className="flex items-start gap-3">
        {/* A real checkbox: Space toggles it, and screen readers announce its state. */}
        <input
          type="checkbox"
          checked={done}
          onChange={() => update.mutate({ id: item.id, patch: { status: done ? 'todo' : 'done' } })}
          aria-label={done ? `Mark “${item.text}” as not done` : `Mark “${item.text}” as done`}
          className="mt-0.5 size-5 shrink-0 cursor-pointer accent-accent"
        />
        <div className="min-w-0 flex-1">
          <p className={cn('font-semibold', done && 'text-muted line-through')}>{item.text}</p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <UserRound aria-hidden="true" className="size-4" />
              {item.owner ?? 'No owner'}
            </span>
            {/* Icon + one text run: on narrow screens the words wrap like a sentence instead of
                being squeezed into side-by-side columns. */}
            <span className="inline-flex items-start gap-1.5">
              <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                {item.dueDate ? formatCalendarDate(item.dueDate) : 'No due date'}
                {/* The transcript's own words, so the resolved date can be checked. */}
                {item.dueDateText && <span className="text-muted/80"> (“{item.dueDateText}”)</span>}
              </span>
            </span>
            {overdue && <Badge tone="danger">Overdue</Badge>}
            {item.status === 'in_progress' && <Badge tone="accent">In progress</Badge>}
          </div>

          {item.needsReview && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-warning">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong>Needs review:</strong> {item.reviewReason ?? 'Check this item.'}
              </span>
            </p>
          )}
          {source && <div className="mt-2 text-sm">{source}</div>}
          {update.error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              Couldn’t save: {update.error.message}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-1">
          <IconButton label={`Edit “${item.text}”`} onClick={onEdit}>
            <Pencil aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton label={`Delete “${item.text}”`} onClick={onDelete}>
            <Trash2 aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
      </div>
    </article>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
    >
      {children}
    </button>
  );
}

/** "Line 6" link to the transcript line an item or decision came from. */
export function LineLink({
  meetingId,
  line,
  onJump,
}: {
  meetingId?: string;
  line: number | null;
  onJump?: () => void;
}) {
  if (line === null) return null;
  return (
    <Link
      to={meetingId ? `/meetings/${meetingId}#L${line}` : `#L${line}`}
      onClick={onJump}
      className="font-semibold text-accent hover:underline"
    >
      Line {line}
    </Link>
  );
}
