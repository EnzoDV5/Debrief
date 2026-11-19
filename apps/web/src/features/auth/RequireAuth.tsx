import { Navigate, Outlet, useLocation } from 'react-router';
import { ErrorState } from '@/components/ui/ErrorState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { useMe } from './hooks';

/**
 * Wraps every logged-in page. Logged out → /login, remembering where the user was going.
 * (A UX gate only: the api enforces auth on every request regardless.)
 */
export function RequireAuth() {
  const { data: user, isPending, error, refetch } = useMe();
  const location = useLocation();

  if (isPending) return <FullPageSpinner label="Checking your session" />;

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center p-4">
        <ErrorState
          title="Can't load Debrief"
          message={error.message}
          onRetry={() => void refetch()}
          className="w-full max-w-md"
        />
      </main>
    );
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <Outlet />;
}
