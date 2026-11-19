import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { LoginForm } from '@/features/auth/LoginForm';
import { safeRedirect } from '@/lib/safeRedirect';
import { usePageTitle } from '@/lib/usePageTitle';

/** One-off messages other pages can hand to the login page via navigation state. */
const notices = {
  'account-deleted': 'Your account has been deleted.',
} as const;
type Notice = keyof typeof notices;

export function LoginPage() {
  usePageTitle('Log in');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  const notice = (useLocation().state as { notice?: Notice } | null)?.notice;

  return (
    <>
      <h1 className="text-2xl font-bold">Log in to Debrief</h1>
      <p className="mt-2 text-muted">Welcome back. Your meetings and action items are waiting.</p>

      {notice && notices[notice] && (
        <Alert tone="success" className="mt-6">
          {notices[notice]}
        </Alert>
      )}

      <div className="mt-8">
        {/* After logging in, continue to the page the user originally asked for. */}
        <LoginForm onSuccess={() => navigate(safeRedirect(next), { replace: true })} />
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        New to Debrief?{' '}
        <Link
          to={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}
          className="font-semibold text-accent underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
