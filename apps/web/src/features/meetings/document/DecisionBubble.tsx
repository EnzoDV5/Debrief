import type { Decision } from '@debrief/shared';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconButton, LineLink } from '@/features/actionItems/ActionItemCard';
import { useDeleteDecision, useUpdateDecision } from '@/features/actionItems/hooks';

/** A decision card in the overview, linked back to its source line. */
export function DecisionBubble({ meetingId, decision }: { meetingId: string; decision: Decision }) {
  const update = useUpdateDecision(meetingId);
  const remove = useDeleteDecision(meetingId);
  const [draft, setDraft] = useState<string | null>(null); // null = not editing

  return (
    <article className="rounded-md border border-l-4 border-line border-l-success bg-surface p-3 text-sm shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow mt-1 text-success">Decision</p>
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
        <p className="mt-1 font-semibold">{decision.text}</p>
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
