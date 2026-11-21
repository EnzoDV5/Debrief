// Sends logged-out visitors to the log-in page. The api still checks every request itself.
import { Navigate, Outlet, useLocation } from 'react-router';
import { FullPageError } from '@/components/ui/FullPageError';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { useMe } from './hooks';

export function RequireAuth() {
  const { data: user, isPending, isFetching, error, refetch } = useMe();
  const location = useLocation();

  if (isPending) return <FullPageSpinner label="Checking your session" />;

  if (error) {
    return (
      <FullPageError
        title="Can't load Debrief"
        message="We couldn't reach the Debrief server. Your meetings are safe; this is usually a short hiccup."
        details={error.message}
        retrying={isFetching}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <Outlet />;
}
