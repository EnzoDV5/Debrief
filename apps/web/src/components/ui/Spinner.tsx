// Loading indicators: a small inline spinner, and the full-page Debrief loader.
import { LoaderCircle } from 'lucide-react';
import { PanelBackdrop } from '@/components/layout/PanelBackdrop';
import { cn } from '@/lib/cn';
import { Logo } from './Logo';

export function Spinner({ label, className }: { label?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

// The logo's lines draw themselves over the drifting blobs. Kept in step with the static
// version in index.html, which shows before the JavaScript has loaded.
export function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="relative grid min-h-dvh place-items-center overflow-hidden bg-bg">
      <PanelBackdrop contained />
      <div className="relative flex flex-col items-center motion-safe:animate-loader-in">
        <Logo markOnly size="xl" animated />
        <span aria-hidden="true" className="mt-5 text-3xl font-bold tracking-tight text-fg">
          Debrief
        </span>
        <span aria-hidden="true" className="mt-4 h-1 w-24 overflow-hidden rounded-pill bg-fg/10">
          <span className="block h-full w-2/5 rounded-pill bg-accent motion-safe:animate-loader-bar" />
        </span>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}
