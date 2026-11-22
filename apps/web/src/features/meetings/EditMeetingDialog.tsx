// Edit a meeting's title and date.
import { meetingDetailsSchema, type Meeting } from '@debrief/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { DatePicker, meetingDateShortcuts } from '@/components/ui/DatePicker';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { applyApiError } from '@/lib/formErrors';
import { useUpdateMeeting } from './hooks';

export function EditMeetingDialog({
  meeting,
  open,
  onClose,
}: {
  meeting: Pick<Meeting, 'id' | 'title' | 'meetingDate'>;
  open: boolean;
  onClose: () => void;
}) {
  const update = useUpdateMeeting(meeting.id);
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(meetingDetailsSchema),
    values: { title: meeting.title, meetingDate: meeting.meetingDate },
  });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      onClose();
    } catch (error) {
      applyApiError(error, setError, ['title', 'meetingDate']);
    }
  });

  return (
    <Dialog open={open} onClose={close} title="Edit meeting">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {errors.root?.server && <Alert tone="danger">{errors.root.server.message}</Alert>}
        <Field label="Title" error={errors.title?.message}>
          {(control) => <Input {...control} {...register('title')} />}
        </Field>
        <Field label="Meeting date" error={errors.meetingDate?.message}>
          {(fieldProps) => (
            <Controller
              name="meetingDate"
              control={control}
              render={({ field }) => (
                <DatePicker
                  {...fieldProps}
                  buttonRef={field.ref}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  shortcuts={meetingDateShortcuts()}
                />
              )}
            />
          )}
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
