import type { Decision } from '@debrief/shared';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconButton, LineLink } from '@/features/actionItems/ActionItemCard';
import { useDeleteDecision, useUpdateDecision } from '@/features/actionItems/hooks';
import { cn } from '@/lib/cn';

/** A decision card beside the transcript line where the choice was made. */
export function DecisionBubble({
  meetingId,
  decision,
  active = false,
  onActiveChange,
}: {
  meetingId: string;
  decision: Decision;
  active?: boolean;
  onActiveChange?: (active: boolean) => void;
}) {
  const update = useUpdateDecision(meetingId);
  const remove = useDeleteDecision(meetingId);
  const [draft, setDraft] = useState<string | null>(null); // null = not editing

  return (
    <article
      onMouseEnter={() => onActiveChange?.(true)}
      onMouseLeave={() => onActiveChange?.(false)}
      onFocus={() => onActiveChange?.(true)}
      onBlur={() => onActiveChange?.(false)}
      className={cn(
        'rounded-md border border-l-4 border-line border-l-success bg-surface p-3 text-sm shadow-card transition-shadow',
        active && 'ring-2 ring-success/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow mt-1 inline-flex items-center gap-1.5 text-success">
          <Check aria-hidden="true" className="size-3.5" />
          Agreed decision
        </p>
        {draft === null && (
          <div className="-mt-1 -mr-1 flex shrink-0">
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
          </div>
        )}
      </div>

      {draft === null ? (
        <div className="mt-1">
          <p className="font-semibold">{decision.text}</p>
          <p className="mt-1 text-xs text-muted">
            Keep this as a record of what the team agreed. Edit it if it is incorrect.
          </p>
        </div>
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
      {decision.sourceLine !== null && (
        <p className="mt-2 text-xs text-muted">
          Source: <LineLink line={decision.sourceLine} meetingId={meetingId} />
        </p>
      )}
      {remove.error && (
        <p role="alert" className="mt-2 text-danger">
          Couldn’t delete: {remove.error.message}
        </p>
      )}
    </article>
  );
}
