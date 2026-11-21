// A slim map of the transcript at the side, marking where items and decisions are.
import { useEffect, useMemo, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { PanelOverlay } from '@/components/layout/PageBar';
import { cn } from '@/lib/cn';

export type MapMarker = { line: number; kind: 'action' | 'decision'; label: string };

const MAX_PLAIN_TICKS = 80;

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

  const scrollToPointer = (clientY: number) => {
    const rail = railRef.current?.getBoundingClientRect();
    const area = scroller();
    if (!rail || !area) return;
    const at = Math.min(1, Math.max(0, (clientY - rail.top) / rail.height));
    area.scrollTo({ top: at * area.scrollHeight - area.clientHeight / 2 });
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    scrollToPointer(event.clientY);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) scrollToPointer(event.clientY);
  };
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
          onWheel={(event) => scroller()?.scrollBy({ top: event.deltaY })}
          className="relative h-full w-full cursor-pointer touch-none"
        >
          {geometry &&
            shownLines.map((line) => {
              const top = geometry.tops.get(line);
              if (top === undefined) return null;
              const onScreen = top >= geometry.viewStart && top <= geometry.viewEnd;
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
                      className={cn(
                        'block h-0.5 rounded-pill bg-fg transition-[width] duration-150 group-hover/tick:w-5',
                        onScreen ? 'w-3' : 'w-2',
                      )}
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
                    className={cn(
                      'block h-0.5 w-6 rounded-pill transition-[width,opacity] duration-150 group-hover/tick:w-9 group-focus-visible/tick:w-9',
                      marker.kind === 'action' ? 'bg-accent' : 'bg-success',
                      !onScreen && 'opacity-70',
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
