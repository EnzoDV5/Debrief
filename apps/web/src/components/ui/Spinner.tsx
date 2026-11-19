import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Spinning icon. Pass `label` when it's the only thing telling the user something is loading. */
export function Spinner({ label, className }: { label?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

/** Centered spinner for whole-page loading (first load, lazy routes). */
export function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="grid min-h-dvh place-items-center text-muted">
      <Spinner label={label} className="[&_svg]:size-6" />
    </div>
  );
}
