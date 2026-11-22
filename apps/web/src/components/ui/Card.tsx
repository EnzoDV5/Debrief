// A plain card container.
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={cn('rounded-card border border-glass-edge glass shadow-card', className)}
    />
  );
}
