// Sends people who are already logged in straight to the app.
import { useState } from 'react';
import { Navigate, Outlet, useSearchParams } from 'react-router';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { safeRedirect } from '@/lib/safeRedirect';
import { useMe } from './hooks';

export function RedirectIfAuthed() {
  const { data: user, isPending } = useMe();
  const [searchParams] = useSearchParams();

  const [startedLoggedOut, setStartedLoggedOut] = useState(false);
  if (user === null && !startedLoggedOut) setStartedLoggedOut(true);

  if (isPending) return <FullPageSpinner label="Checking your session" />;
  if (user && !startedLoggedOut) {
    return <Navigate to={safeRedirect(searchParams.get('next'))} replace />;
  }
  return <Outlet />;
}
