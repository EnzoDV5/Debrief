import { CircleAlert, RotateCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

/** Shown when loading data failed. Says what happened and offers a retry. */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center rounded-card border border-white/70 glass px-6 py-14 text-center shadow-card',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="mb-4 grid size-12 place-items-center rounded-pill bg-danger-soft text-danger"
      >
        <CircleAlert className="size-6" />
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted">{message}</p>
      {onRetry && (
        <Button
          variant="secondary"
          className="mt-6"
          onClick={onRetry}
          icon={<RotateCw className="size-4" />}
        >
          Try again
        </Button>
      )}
    </div>
  );
}
