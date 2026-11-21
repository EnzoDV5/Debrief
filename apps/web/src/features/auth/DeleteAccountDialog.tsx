// Delete account: asks for the password (or the email, for Google accounts) first.
import { deleteWithEmailSchema, deleteWithPasswordSchema } from '@debrief/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input, PasswordInput } from '@/components/ui/Input';
import { useDeleteAccount, useMe } from './hooks';

const byPassword = z.object({ confirm: deleteWithPasswordSchema.shape.password });
const byEmail = z.object({ confirm: deleteWithEmailSchema.shape.email });

export function DeleteAccountDialog({
  open,
  onClose,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { data: user } = useMe();
  const withPassword = user?.hasPassword ?? true;
  const deleteAccount = useDeleteAccount();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(withPassword ? byPassword : byEmail),
    defaultValues: { confirm: '' },
  });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async ({ confirm }) => {
    try {
      await deleteAccount.mutateAsync(withPassword ? { password: confirm } : { email: confirm });
      onDeleted();
    } catch (error) {
      const fieldMessage =
        error instanceof ApiError ? (error.fields?.password ?? error.fields?.email) : undefined;
      if (fieldMessage) {
        setError('confirm', { type: 'server', message: fieldMessage }, { shouldFocus: true });
      } else {
        const message = error instanceof Error ? error.message : 'Something went wrong';
        setError('root.server', { type: 'server', message });
      }
    }
  });

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Delete your account?"
      description="You'll be logged out on every device and won't be able to sign in again. Your meetings and action items will no longer be accessible."
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {errors.root?.server && <Alert tone="danger">{errors.root.server.message}</Alert>}

        {withPassword ? (
          <Field label="Enter your password to confirm" error={errors.confirm?.message}>
            {(control) => (
              <PasswordInput
                {...control}
                {...register('confirm')}
                autoComplete="current-password"
                autoFocus
              />
            )}
          </Field>
        ) : (
          <Field
            label="Type your email to confirm"
            hint={`You sign in with Google, so type ${user?.email ?? 'your email'} to confirm.`}
            error={errors.confirm?.message}
          >
            {(control) => (
              <Input
                {...control}
                {...register('confirm')}
                type="email"
                inputMode="email"
                autoComplete="off"
                autoFocus
              />
            )}
          </Field>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={isSubmitting}>
            {isSubmitting ? 'Deleting…' : 'Delete my account'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
