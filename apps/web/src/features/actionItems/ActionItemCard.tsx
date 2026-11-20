import type { ActionItem, ActionItemStatus } from '@debrief/shared';
import {
  CalendarDays,
  Check,
  ListChecks,
  Pencil,
  Trash2,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/Badge';
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

/**
 * The shell every result card shares (action items and decisions): same surface, border, padding
 * and header, so the two kinds only differ by their colour. `group` lets the header's edit and
 * delete buttons appear on hover.
 */
export function noteCardClass(kind: NoteKind, active: boolean) {
  return cn(
    'group overflow-hidden rounded-card border border-line glass p-4 shadow-card transition-[box-shadow,border-color] duration-200',
    active && (kind === 'decision' ? 'ring-2 ring-success/40' : 'ring-2 ring-accent/40'),
  );
}

type NoteKind = 'action' | 'decision';

const KIND = {
  action: { label: 'Action', icon: ListChecks, chip: 'bg-accent-soft text-accent' },
  decision: { label: 'Decision', icon: Check, chip: 'bg-success-soft text-success' },
} as const;

/**
 * Card header: what kind of result it is, the transcript line it came from, "Edited by you", and
 * the card's buttons on the right.
 */
export function NoteCardHeader({
  kind,
  line,
  edited = false,
  actions,
}: {
  kind: NoteKind;
  /** Shown as plain text: on the meeting page the line number beside the card is the link. */
  line?: number | null;
  edited?: boolean;
  actions?: ReactNode;
}) {
  const { label, icon: Icon, chip } = KIND[kind];
  return (
    <div className="flex min-h-8 items-center gap-2">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-semibold',
          chip,
        )}
      >
        <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
        {label}
      </span>
      {line != null && <span className="text-xs text-muted numeric">Line {line}</span>}
      {/* The transcript stays as it was said; this tells the reader the card was reworded. */}
      {edited && (
        <span className="text-xs text-muted">
          <span aria-hidden="true">· </span>
          <span title="You changed this card. The transcript still shows what was originally said.">
            Edited by you
          </span>
        </span>
      )}
      {actions && (
        // Mouse users see the buttons on hover or focus, so a column of cards stays calm. Touch
        // screens (no hover) always show them. They're always in the page for keyboard and
        // screen-reader users.
        <div className="-my-1 -mr-2 ml-auto flex shrink-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0">
          {actions}
        </div>
      )}
    </div>
  );
}

/** Small round initials, like an avatar, for the person named as owner. */
export function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const letters = (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '');
  return (
    <span
      aria-hidden="true"
      className="grid size-5 place-items-center rounded-pill bg-accent text-[0.625rem] font-bold text-accent-fg"
    >
      {letters.toUpperCase()}
    </span>
  );
}

/** The owner and due-date pills (also used by the sign-in page's how-it-works demo). */
export const cardChip =
  'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium';

/**
 * One action item: tick box, task, owner, due date, review warning and where it came from.
 * Used on the meeting page and on "My open items" (which adds a link back to the meeting).
 */
export function ActionItemCard({
  item,
  source,
  line,
  onEdit,
  onDelete,
  active = false,
  onActiveChange,
}: {
  item: ActionItem;
  /** Context under the task: "In brief" on a meeting page, the meeting's name on "My open items". */
  source?: ReactNode;
  /** Its transcript line, shown in the header (the meeting page passes it). */
  line?: number | null;
  onEdit: () => void;
  onDelete: () => void;
  /** Its words are highlighted in the transcript right now. */
  active?: boolean;
  /** Hovering or focusing the card lights up its words in the transcript. */
  onActiveChange?: (active: boolean) => void;
}) {
  const update = useUpdateActionItem();
  const done = item.status === 'done';
  const overdue = isOverdue(item);

  return (
    <article
      onMouseEnter={() => onActiveChange?.(true)}
      onMouseLeave={() => onActiveChange?.(false)}
      onFocus={() => onActiveChange?.(true)}
      onBlur={() => onActiveChange?.(false)}
      className={noteCardClass('action', active)}
    >
      {item.needsReview && (
        // A strip across the top of the card: hard to miss, but doesn't push the task aside.
        <p className="-mx-4 -mt-4 mb-3 flex items-start gap-1.5 bg-warning-soft px-4 py-2 text-xs text-warning">
          <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>
            <strong>Needs review:</strong> {item.reviewReason ?? 'Check this item.'}
          </span>
        </p>
      )}

      <NoteCardHeader
        kind="action"
        line={line}
        edited={item.editedAt !== null}
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

      <div className="mt-2 flex items-start gap-3">
        {/* A real checkbox: Space toggles it, and screen readers announce its state. */}
        <input
          type="checkbox"
          checked={done}
          onChange={() => update.mutate({ id: item.id, patch: { status: done ? 'todo' : 'done' } })}
          aria-label={done ? `Mark “${item.text}” as not done` : `Mark “${item.text}” as done`}
          className="mt-0.5 size-5 shrink-0 cursor-pointer accent-accent"
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'leading-snug font-semibold text-pretty',
              done && 'text-muted line-through',
            )}
          >
            {item.text}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(cardChip, 'bg-surface-2 pl-1', item.owner ? 'text-fg' : 'text-muted')}
            >
              {item.owner ? (
                <Initials name={item.owner} />
              ) : (
                <UserRound aria-hidden="true" className="ml-1 size-3.5" />
              )}
              {item.owner ?? 'No owner'}
            </span>
            <span
              className={cn(
                cardChip,
                overdue ? 'bg-danger-soft text-danger' : 'bg-surface-2',
                !item.dueDate && 'text-muted',
              )}
            >
              <CalendarDays aria-hidden="true" className="size-3.5" />
              {item.dueDate ? formatCalendarDate(item.dueDate) : 'No due date'}
            </span>
            {overdue && <Badge tone="danger">Overdue</Badge>}
            {item.status === 'in_progress' && <Badge tone="accent">In progress</Badge>}
          </div>
          {/* The transcript's own words, so the resolved date can be checked. */}
          {item.dueDateText && (
            <p className="mt-1.5 text-xs text-muted">Said as “{item.dueDateText}”</p>
          )}

          {source && <div className="mt-3 text-sm">{source}</div>}
          <AddToCalendar item={item} />
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

export function IconButton({
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
      className="inline-flex size-8 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
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
  className,
}: {
  meetingId?: string;
  line: number | null;
  onJump?: () => void;
  /** e.g. a lighter colour where the link sits on a dark background. */
  className?: string;
}) {
  if (line === null) return null;
  return (
    <Link
      to={meetingId ? `/meetings/${meetingId}#L${line}` : `#L${line}`}
      onClick={onJump}
      className={cn('font-semibold text-accent hover:underline', className)}
    >
      Line {line}
    </Link>
  );
}
