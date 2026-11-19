import { PASSWORD_MIN_LENGTH, registerSchema } from '@debrief/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input, PasswordInput } from '@/components/ui/Input';
import { applyApiError } from '@/lib/formErrors';
import { useRegister } from './hooks';

export function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const registerUser = useRegister();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerUser.mutateAsync(values);
      onSuccess();
    } catch (error) {
      // e.g. "An account with this email already exists" appears under the email field.
      applyApiError(error, setError, ['name', 'email', 'password']);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {errors.root?.server && <Alert tone="danger">{errors.root.server.message}</Alert>}

      <Field label="Name" error={errors.name?.message}>
        {(control) => (
          <Input {...control} {...register('name')} autoComplete="name" placeholder="Alex Smith" />
        )}
      </Field>

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

      <Field
        label="Password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. A short phrase is easiest to remember.`}
        error={errors.password?.message}
      >
        {(control) => (
          // "new-password" lets password managers suggest a strong one.
          <PasswordInput {...control} {...register('password')} autoComplete="new-password" />
        )}
      </Field>

      <Button type="submit" fullWidth loading={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
