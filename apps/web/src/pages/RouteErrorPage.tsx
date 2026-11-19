import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { ErrorState } from '@/components/ui/ErrorState';

/**
 * Last line of defence: shown if a page crashes while rendering (or a lazy page chunk fails to
 * download, e.g. after a deploy). Better than a white screen.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="grid min-h-dvh place-items-center p-4">
      <ErrorState
        message="This page hit an unexpected problem. Reloading usually fixes it."
        onRetry={() => window.location.reload()}
        className="w-full max-w-md"
      />
    </main>
  );
}
