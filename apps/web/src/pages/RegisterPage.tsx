// The sign-up page.
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useLeaveAuth, type EntranceState } from '@/components/layout/authExit';
import { GoogleSignInButton } from '@/features/auth/GoogleSignInButton';
import { RegisterForm } from '@/features/auth/RegisterForm';
import { safeRedirect } from '@/lib/safeRedirect';
import { usePageTitle } from '@/lib/usePageTitle';

export function RegisterPage() {
  usePageTitle('Create account');
  const navigate = useNavigate();
  const leave = useLeaveAuth();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');

  return (
    <>
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-2 text-muted">Turn meetings into clear decisions and action items.</p>

      <div className="mt-6 space-y-5">
        <RegisterForm
          alternative={<GoogleSignInButton label="Sign up with Google" next={next} />}
          onSuccess={() =>
            leave(() =>
              navigate(safeRedirect(next), {
                replace: true,
                state: { entrance: true, welcome: true } satisfies EntranceState,
              }),
            )
          }
        />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link
          viewTransition
          to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
          className="font-semibold text-spark underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </>
  );
}
