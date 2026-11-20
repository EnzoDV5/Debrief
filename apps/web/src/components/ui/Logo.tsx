import { cn } from '@/lib/cn';

/**
 * Debrief mark: three transcript lines, the last one "picked out" in lime, like an action item
 * lifted from the conversation. Plus the wordmark.
 */
export function Logo({
  inverse = false,
  markOnly = false,
  bare = false,
  size = 'md',
  className,
}: {
  /** White wordmark for use on the dark frame. */
  inverse?: boolean;
  /** Just the square mark, no wordmark (the collapsed sidebar). */
  markOnly?: boolean;
  /** No square behind the lines: just the cobalt and lime lines (the sign-in panel). */
  bare?: boolean;
  /** xl: the large centred logo on the sign-in panel. */
  size?: 'md' | 'xl';
  className?: string;
}) {
  const lineFill = inverse ? 'var(--color-accent)' : bare ? 'var(--color-accent)' : '#fff';
  return (
    <span
      className={cn('inline-flex items-center', size === 'xl' ? 'gap-4' : 'gap-2.5', className)}
    >
      <svg
        // Bare: crop the view to the lines themselves, so the mark isn't padded by the
        // (now invisible) square around them.
        viewBox={bare ? '7 8 18 16' : '0 0 32 32'}
        aria-hidden="true"
        className={cn('shrink-0', size === 'xl' ? 'size-16' : 'size-8')}
      >
        {!bare && (
          <rect width="32" height="32" rx="9" fill={inverse ? '#ffffff' : 'var(--color-accent)'} />
        )}
        <rect x="8" y="9" width="16" height="2.5" rx="1.25" fill={lineFill} />
        <rect x="8" y="14.75" width="12" height="2.5" rx="1.25" fill={lineFill} />
        <rect x="8" y="20.5" width="8" height="2.5" rx="1.25" fill="var(--color-spark)" />
        <circle cx="21.5" cy="21.75" r="2.25" fill="var(--color-spark)" />
      </svg>
      {!markOnly && (
        <span
          className={cn(
            'font-bold tracking-tight',
            size === 'xl' ? 'text-5xl' : 'text-lg',
            inverse ? 'text-white' : 'text-fg',
          )}
        >
          Debrief
        </span>
      )}
    </span>
  );
}
