// A whole-screen "something broke" page, in the same style as the loader: logo, drifting blobs and
// a calm card with a way forward. The technical detail is tucked away for anyone who needs it.
import { CloudOff, House, RotateCw } from 'lucide-react';
import { PanelBackdrop } from '@/components/layout/PanelBackdrop';
import { Button } from './Button';
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
        <div
          role="alert"
          className="mt-8 w-full rounded-panel border border-white/70 glass-float px-6 py-10 text-center shadow-raised sm:px-10"
        >
          <div className="relative mx-auto grid size-16 place-items-center">
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-pill bg-danger-soft motion-safe:animate-ping motion-safe:[animation-duration:2.4s]"
            />
            <span className="relative grid size-16 place-items-center rounded-pill bg-danger-soft text-danger ring-8 ring-danger-soft/40">
              <CloudOff aria-hidden="true" className="size-7" />
            </span>
          </div>
          <h1 className="mt-6 text-2xl font-bold">{title}</h1>
          <p className="mx-auto mt-2 max-w-sm text-base text-muted">{message}</p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button onClick={onRetry} loading={retrying} icon={<RotateCw className="size-4" />}>
              Try again
            </Button>
            {showHome && (
              <Button variant="secondary" to="/meetings" icon={<House className="size-4" />}>
                Back to home
              </Button>
            )}
          </div>

          {details && (
            <details className="group mt-7 text-left">
              <summary className="cursor-pointer list-none text-center text-sm font-semibold text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
                Technical details
              </summary>
              <p className="mt-3 rounded-md bg-surface-2 px-3 py-2 font-mono text-sm break-words text-muted">
                {details}
              </p>
            </details>
          )}
        </div>
        <p className="mt-5 text-center text-sm text-muted">
          Still stuck? Check your connection, or try again in a minute.
        </p>
      </div>
    </main>
  );
}
