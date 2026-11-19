import { cn } from '@/lib/cn';

/**
 * Debrief mark: three transcript lines, the last one "picked out" in lime, like an action item
 * lifted from the conversation. Plus the wordmark.
 */
export function Logo({
  inverse = false,
  className,
}: {
  /** White wordmark for use on the cobalt brand panel. */
  inverse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-8 shrink-0">
        <rect width="32" height="32" rx="9" fill={inverse ? '#ffffff' : 'var(--color-accent)'} />
        <rect
          x="8"
          y="9"
          width="16"
          height="2.5"
          rx="1.25"
          fill={inverse ? 'var(--color-accent)' : '#fff'}
        />
        <rect
          x="8"
          y="14.75"
          width="12"
          height="2.5"
          rx="1.25"
          fill={inverse ? 'var(--color-accent)' : '#fff'}
        />
        <rect x="8" y="20.5" width="8" height="2.5" rx="1.25" fill="var(--color-spark)" />
        <circle cx="21.5" cy="21.75" r="2.25" fill="var(--color-spark)" />
      </svg>
      <span
        className={cn('text-lg font-bold tracking-[-0.02em]', inverse ? 'text-white' : 'text-fg')}
      >
        Debrief
      </span>
    </span>
  );
}
