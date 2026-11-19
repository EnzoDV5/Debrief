import { useState } from 'react';
import { Navigate, Outlet, useSearchParams } from 'react-router';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { safeRedirect } from '@/lib/safeRedirect';
import { useMe } from './hooks';

/** Wraps /login and /register: someone already logged in goes straight into the app. */
export function RedirectIfAuthed() {
  const { data: user, isPending } = useMe();
  const [searchParams] = useSearchParams();

  // Only redirect visitors who *arrived* logged in. When someone logs in or registers on this
  // page, the form navigates itself (it can carry extra state, like the welcome message);
  // redirecting here as well would race it and drop that state.
  // (Updating state during render is React's documented way to react to a changed value.)
  const [startedLoggedOut, setStartedLoggedOut] = useState(false);
  if (user === null && !startedLoggedOut) setStartedLoggedOut(true);

  if (isPending) return <FullPageSpinner label="Checking your session" />;
  // If the session check failed (e.g. api down), still show the form: submitting it will
  // surface a clear error, which is better than a blank page.
  if (user && !startedLoggedOut) {
    return <Navigate to={safeRedirect(searchParams.get('next'))} replace />;
  }
  return <Outlet />;
}
