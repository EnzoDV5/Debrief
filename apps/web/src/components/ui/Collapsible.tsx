// Slides its content open and closed smoothly.
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Collapsible({
  id,
  open,
  children,
}: {
  id: string;
  open: boolean;
  children: ReactNode;
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
      <div className="min-h-0 overflow-hidden px-px pb-1">
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}
