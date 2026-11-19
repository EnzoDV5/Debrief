import type { Meeting } from '@debrief/shared';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useDeleteMeeting } from './hooks';

/** Deleting is permanent, so it always asks first and names exactly what will go. */
export function DeleteMeetingDialog({
  meeting,
  open,
  onClose,
  onDeleted,
}: {
  meeting: Meeting;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const remove = useDeleteMeeting(meeting.id);

  return (
    <Dialog
      open={open}
      onClose={() => {
        remove.reset();
        onClose();
      }}
      title="Delete this meeting?"
      description={
        <>
          <strong className="text-fg">{meeting.title}</strong> and its transcript will be
          permanently deleted. This can&apos;t be undone.
        </>
      }
    >
      {remove.error && (
        <Alert tone="danger" className="mb-5">
          {remove.error.message}
        </Alert>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={remove.isPending}>
          Cancel
        </Button>
        <Button
          variant="danger"
          loading={remove.isPending}
          onClick={() => remove.mutate(undefined, { onSuccess: onDeleted })}
        >
          {remove.isPending ? 'Deleting…' : 'Delete meeting'}
        </Button>
      </div>
    </Dialog>
  );
}
