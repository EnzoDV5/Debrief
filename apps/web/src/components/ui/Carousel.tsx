// A left-to-right row of cards with no visible scrollbar. It runs to the edges of the frame; the
// side fades only appear once there is more to scroll to. Drag it with the mouse, use the arrow buttons, or scroll sideways
// with a trackpad or Shift + wheel. The normal wheel still scrolls the page, so it never traps you.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const DRAG_THRESHOLD = 6;
// Snapping can leave the row a few pixels in; still counts as "at the start".
const EDGE_SLACK = 8;

export function Carousel({ label, children }: { label: string; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const [edges, setEdges] = useState({ start: true, end: true });
  const [dragging, setDragging] = useState(false);

  // Which ends have more cards beyond them (shows the arrows and edge fades).
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () =>
      setEdges({
        start: el.scrollLeft <= EDGE_SLACK,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - EDGE_SLACK,
      });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    resize?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      resize?.disconnect();
    };
  }, []);

  const scrollByPage = (direction: 1 | -1) =>
    track.current?.scrollBy({
      left: direction * track.current.clientWidth * 0.8,
      behavior: 'smooth',
    });

  // Mouse drag only; touch already scrolls natively. Clicks on buttons, links and fields still work.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, a, input, select, textarea, label')) return;
    drag.current = { x: event.clientX, left: track.current?.scrollLeft ?? 0, moved: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const el = track.current;
    if (!state || !el) return;
    const dx = event.clientX - state.x;
    if (!state.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
    if (!state.moved) {
      state.moved = true;
      setDragging(true);
      el.setPointerCapture(event.pointerId);
    }
    el.scrollLeft = state.left - dx;
  };
  const endDrag = () => {
    // A drag ends with a click on whatever card is under the mouse: swallow that one click.
    justDragged.current = drag.current?.moved ?? false;
    drag.current = null;
    setDragging(false);
  };

  const arrow =
    'absolute top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-pill border border-glass-edge glass-float text-fg shadow-raised transition-opacity duration-200 hover:text-accent';

  return (
    <div className="relative">
      <div
        ref={track}
        role="region"
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(event) => {
          if (!justDragged.current) return;
          justDragged.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        className={cn(
          // relative: absolutely positioned bits inside the cards (like screen-reader-only text)
          // are then clipped by this row too. Without it they stretched the whole page sideways.
          'relative flex scroll-px-4 [scrollbar-width:none] gap-4 overflow-x-auto overscroll-x-contain px-4 pt-1 pb-4 sm:scroll-px-8 sm:px-8 [&::-webkit-scrollbar]:hidden',
          dragging ? 'cursor-grabbing select-none' : 'cursor-grab snap-x snap-mandatory',
          !edges.start && !edges.end && 'carousel-fade-both',
          !edges.start && edges.end && 'carousel-fade-start',
          edges.start && !edges.end && 'carousel-fade-end',
        )}
      >
        {children}
      </div>
      <button
        type="button"
        aria-label="Scroll left"
        onClick={() => scrollByPage(-1)}
        className={cn(arrow, 'left-0', edges.start && 'pointer-events-none opacity-0')}
        tabIndex={edges.start ? -1 : 0}
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </button>
      <button
        type="button"
        aria-label="Scroll right"
        onClick={() => scrollByPage(1)}
        className={cn(arrow, 'right-0', edges.end && 'pointer-events-none opacity-0')}
        tabIndex={edges.end ? -1 : 0}
      >
        <ChevronRight aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
