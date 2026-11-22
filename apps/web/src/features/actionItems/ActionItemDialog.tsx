// The form for adding or editing an action item: what needs doing, who does it, by when, and how
// far along it is. Shows the transcript line it came from so the details can be checked.
import {
  ACTION_ITEM_STATUSES,
  createActionItemSchema,
  type ActionItem,
  type Decision,
  type TranscriptLine,
} from '@debrief/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Quote, TriangleAlert } from 'lucide-react';
import { useId } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Input';
import { DatePicker, dueDateShortcuts } from '@/components/ui/DatePicker';
import { NameCombobox } from '@/components/ui/NameCombobox';
import { Select } from '@/components/ui/Select';
import { applyApiError } from '@/lib/formErrors';
import { formatLongCalendarDate } from '@/lib/format';
import { STATUS_LABELS } from './ActionItemCard';
import { useCreateActionItem, useUpdateActionItem } from './hooks';

type FormInput = z.input<typeof createActionItemSchema>;
type FormOutput = z.output<typeof createActionItemSchema>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Keeps long decisions to one line in the dropdown, which can't be wider than the pop-up.
const shorten = (text: string) => (text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text);

export function ActionItemDialog({
  open,
  onClose,
  meetingId,
  item,
  ownerSuggestions = [],
  suggestionsLabel = 'People in this meeting',
  initialText,
  source,
  transcriptLine,
  decisions,
  initialDecisionId,
}: {
  open: boolean;
  onClose: () => void;
  meetingId: string;
  item?: ActionItem;
  ownerSuggestions?: string[];
  suggestionsLabel?: string;
  initialText?: string;
  // A new item made from the transcript: the line and the words picked (saved with the item).
  source?: { line: number; quote: string | null };
  // The whole transcript line, when the page has it: shown instead of the shorter quote.
  transcriptLine?: TranscriptLine;
  // This meeting's decisions, for "For decision". Left out where they aren't loaded (the
  // Actions page): the field is hidden there, but an existing link is still kept on save.
  decisions?: Decision[];
  // "+ Add a task" on a decision card: the new task starts linked to that decision.
  initialDecisionId?: string;
}) {
  const create = useCreateActionItem(meetingId);
  const update = useUpdateActionItem();
  const captionId = useId();

  const {
    register,
    control,
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
      // Always sent, so saving an edit never drops the task's decision link.
      decisionId: item?.decisionId ?? initialDecisionId ?? '',
    },
  });
  // Live values: the hint spells out the date, the status highlight slides to the chosen one.
  const dueDate = useWatch({ control, name: 'dueDate' }) ?? '';
  const status = useWatch({ control, name: 'status' }) ?? 'todo';

  // What was said: the real transcript line if we have it, else the AI's quote or the picked words.
  const lineNumber = transcriptLine?.n ?? item?.sourceLine ?? source?.line ?? null;
  const said = transcriptLine?.text ?? item?.sourceQuote ?? source?.quote ?? null;

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
      applyApiError(error, setError, ['text', 'owner', 'dueDate', 'status', 'decisionId']);
    }
  });

  // The date in words, plus the words said in the meeting, so both are easy to check.
  const dueDateHint = [
    ISO_DATE.test(dueDate) ? formatLongCalendarDate(dueDate) : null,
    item?.dueDateText ? `said in the meeting as “${item.dueDateText}”` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Dialog
      open={open}
      onClose={close}
      size="lg"
      title={item ? 'Edit action item' : 'Add an action item'}
      description={
        item
          ? undefined
          : initialDecisionId
            ? 'Add a task that puts this decision into action.'
            : source
              ? 'Turn what was said into a short task. It will sit beside that line.'
              : 'Add a task the AI missed. Items you add stay when the meeting is re-analysed.'
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {errors.root?.server && <Alert tone="danger">{errors.root.server.message}</Alert>}

        {item?.needsReview && (
          <div
            role="status"
            className="flex gap-3 rounded-card bg-warning-soft p-3.5 ring-1 ring-warning/30"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-pill bg-warning/15 text-warning">
              <TriangleAlert aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-fg">Check this item</p>
              <p className="mt-0.5 text-fg/80">
                {item.reviewReason ?? 'Some details couldn’t be matched to the transcript.'}
              </p>
              <p className="mt-1 text-muted">Saving your changes marks this item as reviewed.</p>
            </div>
          </div>
        )}

        {/* Two columns on wider screens (what was said and the task | who, when, status), so the
            pop-up stays square instead of growing taller than the screen. */}
        <div className="grid gap-5 md:grid-cols-2 md:gap-x-7">
          <div className="space-y-5">
            {lineNumber !== null && said && (
              <figure
                aria-labelledby={captionId}
                className="flex gap-3 rounded-card bg-surface/70 p-3.5 ring-1 ring-line"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-pill bg-accent-soft text-accent">
                  <Quote aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0">
                  <figcaption
                    id={captionId}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                  >
                    <span className="sr-only">From the transcript: </span>
                    {transcriptLine?.speaker && (
                      <span className="font-semibold text-fg">{transcriptLine.speaker}</span>
                    )}
                    <span className="rounded-pill bg-surface px-2 py-0.5 text-xs font-semibold text-muted tabular-nums ring-1 ring-line">
                      Line {lineNumber}
                    </span>
                  </figcaption>
                  <blockquote className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-fg/80">
                    “{said}”
                  </blockquote>
                </div>
              </figure>
            )}

            <Field label="What needs to be done" error={errors.text?.message}>
              {(control) => <Textarea {...control} {...register('text')} rows={3} />}
            </Field>

            {decisions && decisions.length > 0 && (
              <Field
                label="For decision"
                optional
                hint="The decision this task puts into action."
                error={errors.decisionId?.message}
              >
                {(fieldProps) => (
                  <Controller
                    name="decisionId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...fieldProps}
                        label="For decision"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        options={[
                          { value: '', label: 'No decision' },
                          ...decisions.map((decision) => ({
                            value: decision.id,
                            label: shorten(decision.text),
                          })),
                        ]}
                        className="w-full rounded-md font-medium"
                      />
                    )}
                  />
                )}
              </Field>
            )}
          </div>

          <div className="space-y-5">
            <Field
              label="Assigned to"
              optional
              hint="The person who will do it."
              error={errors.owner?.message}
            >
              {(fieldProps) => (
                <Controller
                  name="owner"
                  control={control}
                  render={({ field }) => (
                    <NameCombobox
                      {...fieldProps}
                      inputRef={field.ref}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      names={ownerSuggestions}
                      listLabel={suggestionsLabel}
                      placeholder="Type a name or pick one"
                    />
                  )}
                />
              )}
            </Field>

            <Field
              label="Due date"
              optional
              hint={dueDateHint || undefined}
              error={errors.dueDate?.message}
            >
              {(fieldProps) => (
                <Controller
                  name="dueDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      {...fieldProps}
                      buttonRef={field.ref}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="No due date"
                      shortcuts={dueDateShortcuts()}
                      clearable
                    />
                  )}
                />
              )}
            </Field>

            {/* Radio buttons styled as a segmented control: every status visible at once, arrow keys
            move between them like any radio group, and the white highlight slides along. */}
            <fieldset>
              <legend className="mb-1.5 block text-sm font-semibold text-fg">Status</legend>
              <div className="relative grid grid-cols-3 rounded-pill bg-surface-2 p-1">
                <span
                  aria-hidden="true"
                  style={{
                    transform: `translateX(${ACTION_ITEM_STATUSES.indexOf(status) * 100}%)`,
                  }}
                  className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-pill bg-surface shadow-card transition-transform duration-300 ease-out"
                />
                {ACTION_ITEM_STATUSES.map((option) => (
                  <label key={option} className="relative cursor-pointer">
                    <input
                      type="radio"
                      value={option}
                      {...register('status')}
                      className="peer sr-only"
                    />
                    <span className="flex min-h-10 items-center justify-center rounded-pill px-2 text-center text-sm font-semibold text-muted transition-colors duration-200 peer-checked:text-fg peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50 hover:text-fg">
                      {STATUS_LABELS[option]}
                    </span>
                  </label>
                ))}
              </div>
              {errors.status?.message && (
                <p className="mt-1.5 text-sm font-medium text-danger">{errors.status.message}</p>
              )}
            </fieldset>
          </div>
        </div>

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
