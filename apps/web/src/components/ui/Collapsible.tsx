// Slides its content open and closed smoothly.
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Collapsible({
  id,
  open,
  children,
  flush = false,
}: {
  id: string;
  open: boolean;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <div
      id={id}
      inert={!open}
      className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-out-3',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className={cn('min-h-0 overflow-hidden', !flush && 'px-px pb-1')}>
        <div className={cn(!flush && 'pt-4')}>{children}</div>
      </div>
    </div>
  );
}
