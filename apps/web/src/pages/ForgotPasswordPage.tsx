// Ask for a password reset link by email.
import { forgotPasswordSchema } from '@debrief/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { AuthMessage } from '@/components/layout/AuthMessage';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { useForgotPassword } from '@/features/auth/hooks';
import { applyApiError } from '@/lib/formErrors';
import { usePageTitle } from '@/lib/usePageTitle';

export function ForgotPasswordPage() {
  usePageTitle('Reset your password');
  const forgot = useForgotPassword();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await forgot.mutateAsync(values);
      setSentTo(values.email);
    } catch (error) {
      applyApiError(error, setError, ['email']);
    }
  });

  if (sentTo) {
    return (
      <>
        <span className="grid size-12 place-items-center rounded-pill bg-accent-soft text-accent">
          <MailCheck aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-bold">Check your email</h1>
        <p className="mt-2 text-muted">
          If there&apos;s a Debrief account for <strong className="text-fg">{sentTo}</strong>,
          we&apos;ve sent it a link to choose a new password. Open it on this or any other device.
          It works for 30 minutes.
        </p>
        <div className="mt-6 space-y-2 text-sm text-muted">
          <p className="font-semibold text-fg">Nothing after a few minutes?</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Look in your spam or junk folder.</li>
            <li>
              Check the address is spelled right, or{' '}
              <button
                type="button"
                className="font-semibold text-spark underline-offset-4 hover:underline"
                onClick={() => setSentTo(null)}
              >
                try a different email
              </button>
              .
            </li>
            <li>
              No account with that email yet?{' '}
              <Link
                viewTransition
                to="/register"
                className="font-semibold text-spark underline-offset-4 hover:underline"
              >
                Create one
              </Link>
              .
            </li>
          </ul>
        </div>
        <p className="mt-8 text-center text-sm">
          <Link
            viewTransition
            to="/login"
            className="font-semibold text-spark underline-offset-4 hover:underline"
          >
            Back to log in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="mt-2 text-muted">
        Enter the email you use for Debrief and we&apos;ll send you a link to choose a new password.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {errors.root?.server && (
          <AuthMessage>
            <Alert tone="danger">{errors.root.server.message}</Alert>
          </AuthMessage>
        )}
        <Field label="Email" error={errors.email?.message} reserveMessage>
          {(field) => (
            <Input
              {...field}
              {...register('email')}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@company.com"
              autoFocus
            />
          )}
        </Field>
        <Button type="submit" fullWidth loading={isSubmitting}>
          {isSubmitting ? 'Sending link…' : 'Send reset link'}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        Remembered it?{' '}
        <Link
          viewTransition
          to="/login"
          className="font-semibold text-spark underline-offset-4 hover:underline"
        >
          Back to log in
        </Link>
      </p>
    </>
  );
}
