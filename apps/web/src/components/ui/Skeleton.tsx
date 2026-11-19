import { cn } from '@/lib/cn';

/**
 * Grey placeholder shaped like the content that's loading. Feels faster than a spinner because
 * the layout doesn't jump when the real content arrives. Hidden from screen readers; the
 * surrounding region announces "Loading" instead.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-line/70', className)} />
  );
}
