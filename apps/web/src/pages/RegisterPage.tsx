import { Link, useNavigate, useSearchParams } from 'react-router';
import { RegisterForm } from '@/features/auth/RegisterForm';
import { safeRedirect } from '@/lib/safeRedirect';
import { usePageTitle } from '@/lib/usePageTitle';

export function RegisterPage() {
  usePageTitle('Create account');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');

  return (
    <>
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-2 text-muted">
        Turn your next meeting into clear decisions and action items in under a minute.
      </p>

      <div className="mt-8">
        <RegisterForm
          onSuccess={() =>
            navigate(safeRedirect(next), { replace: true, state: { welcome: true } })
          }
        />
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link
          to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
          className="font-semibold text-accent underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </>
  );
}
