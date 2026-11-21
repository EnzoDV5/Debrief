// Shown if a page crashes, so the user never gets a white screen.
import { useEffect } from 'react';
import { useRouteError } from 'react-router';
import { FullPageError } from '@/components/ui/FullPageError';

export function RouteErrorPage() {
  const error = useRouteError();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <FullPageError
      title="This page hit a snag"
      message="Something unexpected went wrong while showing this page. Reloading usually fixes it."
      details={error instanceof Error ? error.message : undefined}
      onRetry={() => window.location.reload()}
      showHome
    />
  );
}
