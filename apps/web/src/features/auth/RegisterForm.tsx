import { registerSchema } from '@debrief/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { AuthMessage } from '@/components/layout/AuthMessage';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input, PasswordInput } from '@/components/ui/Input';
import { applyApiError } from '@/lib/formErrors';
import { useRegister } from './hooks';
import { PasswordStrength } from './PasswordStrength';

// The api's sign-up rules (shared), plus "type it again", which only the form needs: it catches
// a typo in a password the person can't see before it locks them out of their new account.
const registerFormSchema = registerSchema
  .extend({ confirmPassword: z.string().min(1, 'Type your password again') })
  .superRefine((values, ctx) => {
    if (values.confirmPassword && values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'The passwords don’t match',
      });
    }
  });

export function RegisterForm({
  onSuccess,
  alternative,
}: {
  onSuccess: () => void;
  /** Another way in, shown beside the Create account button (the Google button). */
  alternative?: ReactNode;
}) {
  const registerUser = useRegister();
  const strengthId = useId();
  // Shown on the button for the moment before the app opens, so it's clear it worked.
  const [created, setCreated] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
    mode: 'onTouched',
  });
  // Live values for the strength bar and the "passwords match" note.
  const [password, confirmPassword] = useWatch({ control, name: ['password', 'confirmPassword'] });
  const matches = confirmPassword.length > 0 && confirmPassword === password;

  const onSubmit = handleSubmit(async ({ confirmPassword: _, ...values }) => {
    try {
      await registerUser.mutateAsync(values);
      setCreated(true);
      onSuccess();
    } catch (error) {
      // e.g. "An account with this email already exists" appears under the email field;
      // anything without a field (offline, too many attempts) shows at the top of the form.
      applyApiError(error, setError, ['name', 'email', 'password']);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      {errors.root?.server && (
        <AuthMessage>
          <Alert tone="danger">{errors.root.server.message}</Alert>
        </AuthMessage>
      )}

      <Field label="Name" error={errors.name?.message} reserveMessage>
        {(field) => (
          <Input {...field} {...register('name')} autoComplete="name" placeholder="Alex Smith" />
        )}
      </Field>

      <Field label="Email" error={errors.email?.message} reserveMessage>
        {(field) => (
          <Input
            {...field}
            {...register('email')}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@company.com"
          />
        )}
      </Field>

      <div className="space-y-2">
        {/* Its error shows in the strength hint line below (see PasswordStrength). */}
        <Field label="Password">
          {(field) => (
            // "new-password" lets password managers suggest a strong one.
            <PasswordInput
              {...field}
              {...register('password')}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={strengthId}
            />
          )}
        </Field>
        <PasswordStrength id={strengthId} password={password} error={errors.password?.message} />
      </div>

      <Field
        reserveMessage
        label="Confirm password"
        hint={matches ? 'The passwords match' : undefined}
        error={errors.confirmPassword?.message}
      >
        {(field) => (
          <PasswordInput {...field} {...register('confirmPassword')} autoComplete="new-password" />
        )}
      </Field>

      {/* Side by side from sm up, stacked on narrow phones. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:flex-1">
          <Button type="submit" fullWidth loading={isSubmitting} disabled={created}>
            {isSubmitting ? 'Creating account…' : created ? 'Account created' : 'Create account'}
          </Button>
        </div>
        {alternative}
      </div>
    </form>
  );
}
