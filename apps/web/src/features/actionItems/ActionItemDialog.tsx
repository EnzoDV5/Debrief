// The form for adding or editing an action item.
import { ACTION_ITEM_STATUSES, createActionItemSchema, type ActionItem } from '@debrief/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { applyApiError } from '@/lib/formErrors';
import { STATUS_LABELS } from './ActionItemCard';
import { useCreateActionItem, useUpdateActionItem } from './hooks';

type FormInput = z.input<typeof createActionItemSchema>;
type FormOutput = z.output<typeof createActionItemSchema>;

export function ActionItemDialog({
  open,
  onClose,
  meetingId,
  item,
  ownerSuggestions = [],
  initialText,
  source,
}: {
  open: boolean;
  onClose: () => void;
  meetingId: string;
  item?: ActionItem;
  ownerSuggestions?: string[];
  initialText?: string;
  source?: { line: number; quote: string };
}) {
  const create = useCreateActionItem(meetingId);
  const update = useUpdateActionItem();
  const listId = useId();

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createActionItemSchema),
    values: {
      text: item?.text ?? initialText ?? '',
      owner: item?.owner ?? '',
      dueDate: item?.dueDate ?? '',
      status: item?.status ?? 'todo',
    },
  });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (item) {
        const { sourceLine: _line, sourceQuote: _quote, ...patch } = values;
        await update.mutateAsync({ id: item.id, patch });
      } else {
        await create.mutateAsync({
          ...values,
          sourceLine: source?.line ?? null,
          sourceQuote: source?.quote ?? null,
        });
      }
      close();
    } catch (error) {
      applyApiError(error, setError, ['text', 'owner', 'dueDate', 'status']);
    }
  });

  return (
    <Dialog
      open={open}
      onClose={close}
      title={item ? 'Edit action item' : 'Add an action item'}
      description={
        item?.needsReview
          ? 'Saving your changes marks this item as reviewed.'
          : item
            ? undefined
            : source
              ? `From line ${source.line} of the transcript. Edit the words into a task; it will sit beside that line.`
              : 'Add a task the AI missed. Items you add stay when the meeting is re-analysed.'
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {errors.root?.server && <Alert tone="danger">{errors.root.server.message}</Alert>}

        <Field label="Task" error={errors.text?.message}>
          {(control) => <Textarea {...control} {...register('text')} rows={2} />}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Owner" hint="Optional" error={errors.owner?.message}>
            {(control) => (
              <>
                <Input {...control} {...register('owner')} list={listId} autoComplete="off" />
                <datalist id={listId}>
                  {ownerSuggestions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field
            label="Due date"
            hint={item?.dueDateText ? `Said in the meeting: “${item.dueDateText}”` : 'Optional'}
            error={errors.dueDate?.message}
          >
            {(control) => <Input {...control} {...register('dueDate')} type="date" />}
          </Field>
        </div>

        <Field label="Status" error={errors.status?.message}>
          {(control) => (
            <select
              {...control}
              {...register('status')}
              className="block min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-base"
            >
              {ACTION_ITEM_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Saving…' : item ? 'Save changes' : 'Add item'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
