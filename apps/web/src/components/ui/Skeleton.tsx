// A grey placeholder shaped like the content that is loading.
import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-line/70', className)} />
  );
}
