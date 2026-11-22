// Set a new password from the reset link.
import { resetPasswordSchema } from '@debrief/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { ApiError } from '@/api/client';
import { AuthMessage } from '@/components/layout/AuthMessage';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/Input';
import { useResetPassword } from '@/features/auth/hooks';
import { PasswordStrength } from '@/features/auth/PasswordStrength';
import { setFlash } from '@/lib/flash';
import { applyApiError } from '@/lib/formErrors';
import { usePageTitle } from '@/lib/usePageTitle';

const formSchema = z
  .object({
    password: resetPasswordSchema.shape.password,
    confirmPassword: z.string().min(1, 'Type your password again'),
  })
  .superRefine((values, ctx) => {
    if (values.confirmPassword && values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'The passwords don’t match',
      });
    }
  });

function tokenFromHash(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token') || null;
}

export function ResetPasswordPage() {
  usePageTitle('Choose a new password');
  const location = useLocation();
  const navigate = useNavigate();
  const reset = useResetPassword();
  const strengthId = useId();
  const [token] = useState(() => tokenFromHash(location.hash));
  const [linkProblem, setLinkProblem] = useState<string | null>(null);

  useEffect(() => {
    if (location.hash) navigate(location.pathname, { replace: true });
  }, [location.hash, location.pathname, navigate]);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '', confirmPassword: '' },
    mode: 'onTouched',
  });
  const [password, confirmPassword] = useWatch({ control, name: ['password', 'confirmPassword'] });
  const matches = confirmPassword.length > 0 && confirmPassword === password;

  const onSubmit = handleSubmit(async ({ password: newPassword }) => {
    if (!token) return;
    try {
      await reset.mutateAsync({ token, password: newPassword });
      setFlash('password-reset');
      navigate('/login', { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'RESET_LINK_INVALID') {
        setLinkProblem(error.message);
      } else {
        applyApiError(error, setError, ['password']);
      }
    }
  });

  if (!token || linkProblem) {
    return (
      <>
        <h1 className="text-2xl font-bold">This link doesn&apos;t work</h1>
        <Alert tone="danger" className="mt-6">
          {linkProblem ??
            'This reset link is incomplete. Open it straight from the email, or ask for a new one.'}
        </Alert>
        <Button to="/forgot-password" fullWidth className="mt-8">
          Send me a new link
        </Button>
        <p className="mt-8 text-center text-sm">
          <Link
            to="/login"
            className="font-semibold text-spark underline-offset-4 hover:underline light:text-accent"
          >
            Back to log in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <p className="mt-2 text-muted">
        After this you&apos;ll be logged out everywhere, so log in again with the new password.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-3">
        {errors.root?.server && (
          <AuthMessage>
            <Alert tone="danger">{errors.root.server.message}</Alert>
          </AuthMessage>
        )}

        <div className="space-y-3">
          <Field label="New password">
            {(field) => (
              <PasswordInput
                {...field}
                {...register('password')}
                autoComplete="new-password"
                autoFocus
                aria-invalid={Boolean(errors.password)}
                aria-describedby={strengthId}
              />
            )}
          </Field>
          <PasswordStrength id={strengthId} password={password} error={errors.password?.message} />
        </div>

        <Field
          reserveMessage
          label="Confirm new password"
          hint={matches ? 'The passwords match' : undefined}
          error={errors.confirmPassword?.message}
        >
          {(field) => (
            <PasswordInput
              {...field}
              {...register('confirmPassword')}
              autoComplete="new-password"
            />
          )}
        </Field>

        <Button type="submit" fullWidth loading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </>
  );
}
