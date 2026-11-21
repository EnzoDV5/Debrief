// Loading spinners, inline and full page.
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Spinner({ label, className }: { label?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

export function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="grid min-h-dvh place-items-center text-muted">
      <Spinner label={label} className="[&_svg]:size-6" />
    </div>
  );
}
