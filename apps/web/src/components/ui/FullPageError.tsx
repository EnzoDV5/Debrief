// A whole-screen "something broke" page, in the same style as the loader: logo, drifting blobs and
// the same error card used inside pages.
import { PanelBackdrop } from '@/components/layout/PanelBackdrop';
import { ErrorState } from './ErrorState';
import { Logo } from './Logo';

export function FullPageError({
  title,
  message,
  details,
  onRetry,
  retrying = false,
  showHome = false,
}: {
  title: string;
  message: string;
  details?: string;
  onRetry: () => void;
  retrying?: boolean;
  showHome?: boolean;
}) {
  return (
    <main
      id="main"
      className="relative grid min-h-dvh place-items-center overflow-hidden bg-bg px-4 py-10"
    >
      <PanelBackdrop contained />
      <div className="relative flex w-full max-w-md flex-col items-center motion-safe:animate-loader-in">
        <Logo />
        <ErrorState
          headingLevel={1}
          title={title}
          message={message}
          details={details}
          onRetry={onRetry}
          retrying={retrying}
          showHome={showHome}
          className="mt-8"
        />
        <p className="mt-5 text-center text-sm text-muted">
          Still stuck? Check your connection, or try again in a minute.
        </p>
      </div>
    </main>
  );
}
