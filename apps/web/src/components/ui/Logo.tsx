// The Debrief logo mark and wordmark. No background tile: the two top lines are blue on light
// backgrounds and white on dark ones (`inverse`); the short bottom line and the dot are lime.
import { cn } from '@/lib/cn';

export function Logo({
  inverse = false,
  markOnly = false,
  size = 'md',
  animated = false,
  className,
}: {
  inverse?: boolean;
  markOnly?: boolean;
  size?: 'md' | 'xl';
  animated?: boolean;
  className?: string;
}) {
  const line = animated ? 'motion-safe:logo-line' : undefined;
  const lineFill = inverse ? '#fff' : 'var(--color-accent)';
  return (
    <span
      className={cn('inline-flex items-center', size === 'xl' ? 'gap-4' : 'gap-2.5', className)}
    >
      {/* The viewBox is cropped to the lines themselves, so the mark fills its box. */}
      <svg
        viewBox="7 8 18 16"
        aria-hidden="true"
        className={cn('shrink-0', size === 'xl' ? 'size-16' : 'size-8')}
      >
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
