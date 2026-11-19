import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Shown when a list has nothing in it yet. Always says what will appear here and, when
 * possible, offers the one action that fills it.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-card border border-dashed border-line-strong/50 glass px-6 py-14 text-center',
        className,
      )}
    >
      {icon && (
        <div
          aria-hidden="true"
          className="mb-4 grid size-12 place-items-center rounded-pill bg-accent-soft text-accent [&_svg]:size-6"
        >
          {icon}
        </div>
      )}
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="mt-1.5 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
