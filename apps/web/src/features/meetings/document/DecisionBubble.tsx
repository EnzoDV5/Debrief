// The card for one decision.
import type { Decision } from '@debrief/shared';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconButton, NoteCardHeader, noteCardClass } from '@/features/actionItems/ActionItemCard';
import { useDeleteDecision, useUpdateDecision } from '@/features/actionItems/hooks';

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
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <article
      onMouseEnter={() => onActiveChange?.(true)}
      onMouseLeave={() => onActiveChange?.(false)}
      onFocus={() => onActiveChange?.(true)}
      onBlur={() => onActiveChange?.(false)}
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
      {remove.error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          Couldn’t delete: {remove.error.message}
        </p>
      )}
    </article>
  );
}
