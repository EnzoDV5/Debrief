import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** White panel on the chalk background: the main container for content. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={cn('rounded-card border border-line bg-surface shadow-card', className)}
    />
  );
}
