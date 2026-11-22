// The one error card used everywhere: inside a page ("Couldn't load your action items") and on the
// full-screen error page. A calm icon, what went wrong, a way forward, and the technical detail
// tucked away for anyone who needs it.
import { CloudOff, House, RotateCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

// What in-page errors say; the raw error goes in "Technical details".
export const LOAD_ERROR_MESSAGE =
  "We couldn't load this just now. Your data is safe; this is usually a short hiccup.";

export function ErrorState({
  title = 'Something went wrong',
  message,
  details,
  onRetry,
  retrying = false,
  showHome = false,
  headingLevel = 2,
  variant = 'card',
  className,
}: {
  title?: string;
  message: string;
  details?: string;
  onRetry?: () => void;
  retrying?: boolean;
  showHome?: boolean;
  headingLevel?: 1 | 2;
  // 'plain': no card behind it, for errors that sit straight on the page frame.
  variant?: 'card' | 'plain';
  className?: string;
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <div
      role="alert"
      className={cn(
        'mx-auto w-full max-w-md px-6 py-10 text-center motion-safe:animate-loader-in sm:px-10',
        variant === 'card' && 'rounded-panel border border-white/70 glass-float shadow-raised',
        className,
      )}
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
      <Heading className="mt-6 text-2xl font-bold">{title}</Heading>
      <p className="mx-auto mt-2 max-w-sm text-base text-muted">{message}</p>

      {(onRetry || showHome) && (
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {onRetry && (
            <Button onClick={onRetry} loading={retrying} icon={<RotateCw className="size-4" />}>
              Try again
            </Button>
          )}
          {showHome && (
            <Button variant="secondary" to="/meetings" icon={<House className="size-4" />}>
              Back to home
            </Button>
          )}
        </div>
      )}

      {details && (
        <details className="mt-7 text-left">
          <summary className="cursor-pointer list-none text-center text-sm font-semibold text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
            Technical details
          </summary>
          <p
            className={cn(
              'mt-3 font-mono text-sm break-words text-muted',
              variant === 'card' ? 'rounded-md bg-surface-2 px-3 py-2' : 'text-center',
            )}
          >
            {details}
          </p>
        </details>
      )}
    </div>
  );
}
