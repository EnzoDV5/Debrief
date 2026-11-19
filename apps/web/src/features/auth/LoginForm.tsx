import { loginSchema } from '@debrief/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input, PasswordInput } from '@/components/ui/Input';
import { applyApiError } from '@/lib/formErrors';
import { useLogin } from './hooks';

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const login = useLogin();
  const {
    register,
    handleSubmit,
    setError,
    resetField,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    // Check a field when the user leaves it, then live as they fix it. No red while typing.
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      onSuccess();
    } catch (error) {
      applyApiError(error, setError, ['email', 'password']);
      // Wrong credentials: keep the email, clear the password and put the cursor back there.
      resetField('password', { keepError: true });
      setFocus('password');
    }
  });

  return (
    // noValidate: our own inline messages instead of the browser's inconsistent bubbles.
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {errors.root?.server && <Alert tone="danger">{errors.root.server.message}</Alert>}

      <Field label="Email" error={errors.email?.message}>
        {(control) => (
          <Input
            {...control}
            {...register('email')}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@company.com"
          />
        )}
      </Field>

      <Field label="Password" error={errors.password?.message}>
        {(control) => (
          <PasswordInput {...control} {...register('password')} autoComplete="current-password" />
        )}
      </Field>

      <Button type="submit" fullWidth loading={isSubmitting}>
        {isSubmitting ? 'Logging in…' : 'Log in'}
      </Button>
    </form>
  );
}
