// The Debrief logo mark and wordmark.
import { cn } from '@/lib/cn';

export function Logo({
  inverse = false,
  markOnly = false,
  bare = false,
  size = 'md',
  animated = false,
  className,
}: {
  inverse?: boolean;
  markOnly?: boolean;
  bare?: boolean;
  size?: 'md' | 'xl';
  animated?: boolean;
  className?: string;
}) {
  const line = animated ? 'motion-safe:logo-line' : undefined;
  const lineFill = inverse ? 'var(--color-accent)' : bare ? 'var(--color-accent)' : '#fff';
  return (
    <span
      className={cn('inline-flex items-center', size === 'xl' ? 'gap-4' : 'gap-2.5', className)}
    >
      <svg
        viewBox={bare ? '7 8 18 16' : '0 0 32 32'}
        aria-hidden="true"
        className={cn('shrink-0', size === 'xl' ? 'size-16' : 'size-8')}
      >
        {!bare && (
          <rect width="32" height="32" rx="9" fill={inverse ? '#ffffff' : 'var(--color-accent)'} />
        )}
        <rect x="8" y="9" width="16" height="2.5" rx="1.25" fill={lineFill} className={line} />
        <rect
          x="8"
          y="14.75"
          width="12"
          height="2.5"
          rx="1.25"
          fill={lineFill}
          className={line}
          style={animated ? { animationDelay: '120ms' } : undefined}
        />
        <rect
          x="8"
          y="20.5"
          width="8"
          height="2.5"
          rx="1.25"
          fill="var(--color-spark)"
          className={line}
          style={animated ? { animationDelay: '240ms' } : undefined}
        />
        <circle
          cx="21.5"
          cy="21.75"
          r="2.25"
          fill="var(--color-spark)"
          className={animated ? 'motion-safe:logo-dot' : undefined}
        />
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
