// Asks before deleting an action item.
import type { ActionItem } from '@debrief/shared';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useLingering } from '@/lib/useLingering';
import { useDeleteActionItem } from './hooks';

export function DeleteActionItemDialog({
  item,
  onClose,
}: {
  item: ActionItem | null;
  onClose: () => void;
}) {
  const remove = useDeleteActionItem();
  const shown = useLingering(item);
  return (
    <Dialog
      open={item !== null}
      onClose={() => {
        remove.reset();
        onClose();
      }}
      title="Delete this action item?"
      description={shown && <>“{shown.text}” will be removed. This can’t be undone.</>}
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
          onClick={() => item && remove.mutate(item.id, { onSuccess: onClose })}
        >
          Delete item
        </Button>
      </div>
    </Dialog>
  );
}
