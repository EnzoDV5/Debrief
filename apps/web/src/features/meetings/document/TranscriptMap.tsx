// A slim map of the transcript on the right: a line per stretch of transcript, coloured lines
// for action items (blue) and decisions (green). The lines on screen glow, lines near the cursor
// grow like a dock, a click glides there and a drag follows your hand.
import { useEffect, useMemo, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { PanelOverlay } from '@/components/layout/PageBar';
import { cn } from '@/lib/cn';

export type MapMarker = { line: number; kind: 'action' | 'decision'; label: string };

const MAX_PLAIN_TICKS = 80;
// How far (as a share of the map) the hover magnification reaches.
const LIFT_REACH = 0.06;

type Geometry = {
  tops: Map<number, number>;
  viewStart: number;
  viewEnd: number;
};

const smooth = (): ScrollBehavior =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

export function TranscriptMap({
  listRef,
  lines,
  markers,
}: {
  listRef: RefObject<HTMLElement | null>;
  lines: number[];
  markers: MapMarker[];
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const scroller = () => listRef.current?.closest<HTMLElement>('[data-scroller]') ?? null;

  const shownLines = useMemo(() => {
    const marked = new Set(markers.map((m) => m.line));
    const step = Math.max(1, Math.ceil(lines.length / MAX_PLAIN_TICKS));
    return lines.filter((line, index) => marked.has(line) || index % step === 0);
  }, [lines, markers]);
  const kindsByLine = useMemo(() => {
    const kinds = new Map<number, MapMarker[]>();
    for (const marker of markers)
      kinds.set(marker.line, [...(kinds.get(marker.line) ?? []), marker]);
    return kinds;
  }, [markers]);

  useEffect(() => {
    const list = listRef.current;
    const area = list?.closest<HTMLElement>('[data-scroller]');
    if (!list || !area) return;
    let tops = new Map<number, number>();
    let frame = 0;
    const view = () => ({
      viewStart: area.scrollTop / (area.scrollHeight || 1),
      viewEnd: (area.scrollTop + area.clientHeight) / (area.scrollHeight || 1),
    });
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const total = area.scrollHeight || 1;
        const areaTop = area.getBoundingClientRect().top;
        tops = new Map();
        for (const line of shownLines) {
          const row = document.getElementById(`L${line}`);
          if (row)
            tops.set(line, (row.getBoundingClientRect().top - areaTop + area.scrollTop) / total);
        }
        setGeometry({ tops, ...view() });
      });
    };
    const onScroll = () =>
      setGeometry((current) => (current ? { ...current, ...view() } : current));
    measure();
    area.addEventListener('scroll', onScroll, { passive: true });
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    resize?.observe(list);
    resize?.observe(area);
    return () => {
      cancelAnimationFrame(frame);
      area.removeEventListener('scroll', onScroll);
      resize?.disconnect();
    };
  }, [listRef, shownLines]);

  const [hover, setHover] = useState<number | null>(null);
  const pointerAt = (clientY: number) => {
    const rail = railRef.current?.getBoundingClientRect();
    return rail ? Math.min(1, Math.max(0, (clientY - rail.top) / rail.height)) : null;
  };
  const scrollToPointer = (clientY: number, behavior: ScrollBehavior) => {
    const area = scroller();
    const at = pointerAt(clientY);
    if (!area || at === null) return;
    area.scrollTo({ top: at * area.scrollHeight - area.clientHeight / 2, behavior });
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    scrollToPointer(event.clientY, smooth());
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    setHover(pointerAt(event.clientY));
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      scrollToPointer(event.clientY, 'auto');
  };
  // 0 far from the cursor, up to 1 right under it.
  const lift = (top: number) =>
    hover === null ? 0 : Math.max(0, 1 - Math.abs(top - hover) / LIFT_REACH);
  const goToLine = (line: number) =>
    document.getElementById(`L${line}`)?.scrollIntoView?.({ block: 'center', behavior: smooth() });

  return (
    <PanelOverlay>
      <nav
        aria-label="Transcript map"
        className="pointer-events-auto absolute top-12 right-2 bottom-12 w-9"
      >
        <div
          ref={railRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
          onWheel={(event) => scroller()?.scrollBy({ top: event.deltaY })}
          className="relative h-full w-full cursor-pointer touch-none"
        >
          {geometry &&
            shownLines.map((line) => {
              const top = geometry.tops.get(line);
              if (top === undefined) return null;
              const onScreen = top >= geometry.viewStart && top <= geometry.viewEnd;
              const near = lift(top);
              const marked = kindsByLine.get(line);
              if (!marked) {
                return (
                  <button
                    key={line}
                    type="button"
                    aria-label={`Jump to line ${line}`}
                    tabIndex={-1}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => goToLine(line)}
                    style={{ top: `${top * 100}%` }}
                    className="group/tick absolute right-0 z-0 flex h-3 w-9 -translate-y-1/2 cursor-pointer items-center justify-end hover:z-20"
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: `${(onScreen ? 12 : 8) + near * 14}px`,
                        opacity: onScreen ? 1 : 0.35 + near * 0.65,
                      }}
                      className="block h-0.5 rounded-pill bg-fg transition-[width,opacity] duration-300 ease-out-3"
                    />
                  </button>
                );
              }
              return marked.map((marker, index) => (
                <button
                  key={`${line}-${marker.kind}`}
                  type="button"
                  aria-label={`Line ${line}: ${marker.label}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => goToLine(line)}
                  style={{
                    top: `calc(${top * 100}% + ${(index - (marked.length - 1) / 2) * 10}px)`,
                  }}
                  className="group/tick absolute right-0 z-0 flex h-3 w-9 -translate-y-1/2 cursor-pointer items-center justify-end hover:z-20 focus-visible:z-20"
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: `${24 + near * 12}px`,
                      opacity: onScreen ? 1 : 0.6 + near * 0.4,
                    }}
                    className={cn(
                      'block h-[3px] rounded-pill transition-[width,opacity,box-shadow] duration-300 ease-out-3 group-focus-visible/tick:w-9!',
                      marker.kind === 'action'
                        ? 'bg-accent group-hover/tick:shadow-[0_0_10px_var(--color-accent)]'
                        : 'bg-success group-hover/tick:shadow-[0_0_10px_var(--color-success)]',
                    )}
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      'pointer-events-none absolute right-full mr-2 w-max max-w-64 rounded-md bg-sidebar px-3 py-2 text-left text-xs leading-5 text-sidebar-fg opacity-0 shadow-raised transition-opacity duration-150 group-hover/tick:opacity-100 group-focus-visible/tick:opacity-100',
                      top < 0.65 ? 'top-0' : 'bottom-0',
                    )}
                  >
                    Line {line} · {marker.label}
                  </span>
                </button>
              ));
            })}
        </div>
      </nav>
    </PanelOverlay>
  );
}
