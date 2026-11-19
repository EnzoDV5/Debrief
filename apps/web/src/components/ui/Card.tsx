import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Liquid-glass panel (translucent, bright top rim): the main container for content. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={cn('glass rounded-card border border-white/70 shadow-card', className)}
    />
  );
}
