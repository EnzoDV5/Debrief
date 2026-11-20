import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Slides its content open and closed (used for the Summary and Ask dropdowns). Animating grid
 * rows from 0fr to 1fr reaches the content's natural height without measuring it.
 * Closed = inert: hidden from keyboard and screen readers. Give the toggle button
 * aria-expanded and aria-controls={id}.
 */
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
      {/* Padding inside the clipped box, so shadows and focus rings aren't cut off when open. */}
      <div className="min-h-0 overflow-hidden px-px pb-1">
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}
