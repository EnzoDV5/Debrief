// The form for adding a decision by hand.
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { useCreateDecision } from '@/features/actionItems/hooks';

export function NewDecisionDialog({
  meetingId,
  onClose,
  initialText = '',
  sourceLine = null,
}: {
  meetingId: string;
  onClose: () => void;
  initialText?: string;
  sourceLine?: number | null;
}) {
  const create = useCreateDecision(meetingId);
  const [text, setText] = useState(initialText);
  return (
    <Dialog
      open
      onClose={() => !create.isPending && onClose()}
      title="Add decision"
      description={
        sourceLine === null
          ? undefined
          : `From line ${sourceLine} of the transcript. It will sit beside that line.`
      }
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate({ text, sourceLine }, { onSuccess: onClose });
        }}
      >
        <Input
          aria-label="New decision"
          placeholder="e.g. Use Resend for the contact form"
          value={text}
          onChange={(event) => setText(event.target.value)}
          autoFocus
        />
        {create.error && <Alert tone="danger">{create.error.message}</Alert>}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={create.isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={create.isPending}>
            Add decision
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
