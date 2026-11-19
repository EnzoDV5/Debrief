import { deleteAccountSchema } from '@debrief/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/Input';
import { applyApiError } from '@/lib/formErrors';
import { useDeleteAccount } from './hooks';

/** Asks for the password before deleting: a stray click (or someone at an open laptop) can't. */
export function DeleteAccountDialog({
  open,
  onClose,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const deleteAccount = useDeleteAccount();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: '' },
  });

  const close = () => {
    reset(); // never leave a typed password sitting in a hidden form
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      await deleteAccount.mutateAsync(values);
      onDeleted();
    } catch (error) {
      applyApiError(error, setError, ['password']);
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

        <Field label="Enter your password to confirm" error={errors.password?.message}>
          {(control) => (
            <PasswordInput
              {...control}
              {...register('password')}
              autoComplete="current-password"
              autoFocus
            />
          )}
        </Field>

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
