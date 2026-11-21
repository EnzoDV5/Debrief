// Smoothly animates its own height to fit whatever is inside. Around the top bar, this makes the
// page frame below glide up or down when the next page's bar is taller or shorter.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function AnimatedHeight({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  const [moving, setMoving] = useState(false);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let last: number | undefined;
    const observer = new ResizeObserver(() => {
      const next = el.offsetHeight;
      if (last !== undefined && last !== next) setMoving(true);
      last = next;
      setHeight(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      style={{ height }}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget) setMoving(false);
      }}
      className={cn(
        'transition-[height] duration-500 ease-panel motion-reduce:transition-none',
        // While it grows or shrinks, the content is revealed (or hidden) with the frame.
        moving && 'overflow-hidden',
        className,
      )}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}
