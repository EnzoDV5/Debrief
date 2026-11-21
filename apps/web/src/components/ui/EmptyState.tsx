// Shown when a list is empty: what will appear here, and how to add it.
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  variant = 'card',
  size = 'normal',
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  variant?: 'card' | 'plain';
  size?: 'normal' | 'large';
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center px-6 py-14 text-center',
        variant === 'card' && 'rounded-card border border-dashed border-line-strong/50 glass',
        className,
      )}
    >
      {icon && (
        <div
          aria-hidden="true"
          className={cn(
            'grid place-items-center rounded-pill bg-accent-soft text-accent',
            size === 'large' ? 'mb-6 size-20 [&_svg]:size-10' : 'mb-4 size-12 [&_svg]:size-6',
          )}
        >
          {icon}
        </div>
      )}
      <h2 className={cn('font-bold', size === 'large' ? 'text-3xl' : 'text-lg')}>{title}</h2>
      {description && (
        <p
          className={cn(
            'text-muted',
            size === 'large' ? 'mt-3 max-w-xl text-lg' : 'mt-1.5 max-w-md text-sm',
          )}
        >
          {description}
        </p>
      )}
      {action && <div className={size === 'large' ? 'mt-8' : 'mt-6'}>{action}</div>}
    </div>
  );
}
