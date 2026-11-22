// The parts every note card shares (action items, decisions, the Ask answers and the sign-in
// demo): the card frame, its header with the kind tag and line number, small icon buttons, the
// chip style and the "Line 12" link to the transcript.
import { Check, ListChecks } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';

export function noteCardClass(kind: NoteKind, active: boolean) {
  return cn(
    'group overflow-hidden rounded-card border border-line glass p-4 shadow-card transition-[box-shadow,border-color] duration-200',
    // Hovered, focused, or the card you jumped to from Actions: a solid ring and border.
    active &&
      (kind === 'decision'
        ? 'border-success ring-2 ring-success'
        : 'border-accent ring-2 ring-accent'),
  );
}

type NoteKind = 'action' | 'decision';

const KIND = {
  action: { label: 'Action', icon: ListChecks, chip: 'bg-accent-soft text-accent' },
  decision: { label: 'Decision', icon: Check, chip: 'bg-success-soft text-success' },
} as const;

export function NoteCardHeader({
  kind,
  line,
  edited = false,
  tags,
  actions,
}: {
  kind: NoteKind;
  line?: number | null;
  edited?: boolean;
  tags?: ReactNode;
  actions?: ReactNode;
}) {
  const { label, icon: Icon, chip } = KIND[kind];
  return (
    // Wraps on narrow cards (phones) instead of pushing the edit buttons out of the card.
    <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-semibold',
          chip,
        )}
      >
        <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
        {label}
      </span>
      {tags}
      {line != null && <span className="text-sm text-muted numeric">Line {line}</span>}
      {edited && (
        <span className="text-sm text-muted">
          <span aria-hidden="true">· </span>
          <span title="You changed this card. The transcript still shows what was originally said.">
            Edited by you
          </span>
        </span>
      )}
      {actions && (
        <div className="-my-1 -mr-2 ml-auto flex shrink-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export const cardChip =
  'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[0.8125rem] font-medium';

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

export function LineLink({
  meetingId,
  line,
  onJump,
  className,
}: {
  meetingId?: string;
  line: number | null;
  onJump?: () => void;
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
