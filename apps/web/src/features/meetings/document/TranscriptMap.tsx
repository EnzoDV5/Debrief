import { useEffect, useMemo, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { PanelOverlay } from '@/components/layout/PageBar';
import { cn } from '@/lib/cn';

export type MapMarker = { line: number; kind: 'action' | 'decision'; label: string };

/** Past this many lines, plain lines are sampled so the map stays calm (marked lines always show). */
const MAX_PLAIN_TICKS = 120;

type Geometry = {
  /** Each shown line's position, 0–1 down the page (measured: rows with cards are taller). */
  tops: Map<number, number>;
  /** The part of the page on screen, 0–1. */
  viewStart: number;
  viewEnd: number;
};

const smooth = (): ScrollBehavior =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

/**
 * A slim map of the transcript on the right edge of the frame (desktop), drawn as a column of
 * short horizontal ticks, one per line, at the line's height. Lines with an action item (cobalt)
 * or a decision (green) get longer ticks; the ticks of the lines on screen are darker, so you can
 * see where you are without a scrollbar. Click or drag along it to move; a long tick is a button
 * that jumps to its line. Faint until hovered, so it doesn't compete with the text.
 *
 * It lives on the panel overlay (fixed while the page scrolls) and follows the shell's scrolling
 * area: positions are measured on resize, and only the "on screen" range changes on scroll.
 */
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

  // Which lines get a tick: every marked line, plus plain lines (sampled on long transcripts).
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
    // Where each line sits on the page: only changes when sizes change, not on scroll.
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
    // Every browser has ResizeObserver; the test environment doesn't, so it's optional.
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    resize?.observe(list);
    resize?.observe(area);
    return () => {
      cancelAnimationFrame(frame);
      area.removeEventListener('scroll', onScroll);
      resize?.disconnect();
    };
  }, [listRef, shownLines]);

  // Centre the transcript on the point of the map under the pointer.
  const scrollToPointer = (clientY: number) => {
    const rail = railRef.current?.getBoundingClientRect();
    const area = scroller();
    if (!rail || !area) return;
    const at = Math.min(1, Math.max(0, (clientY - rail.top) / rail.height));
    area.scrollTo({ top: at * area.scrollHeight - area.clientHeight / 2 });
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Keep following the pointer while dragging, even off the map (optional in tests).
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
        className="pointer-events-auto absolute top-12 right-2 bottom-12 w-6 opacity-70 transition-opacity duration-200 focus-within:opacity-100 hover:opacity-100"
      >
        {/* Click or drag anywhere to move. Wheel scrolling over it still scrolls the page. */}
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
                  <span
                    key={line}
                    aria-hidden="true"
                    style={{ top: `${top * 100}%` }}
                    className={cn(
                      'absolute right-0 h-0.5 w-2 -translate-y-1/2 rounded-pill transition-colors',
                      onScreen ? 'bg-fg/45' : 'bg-line-strong/35',
                    )}
                  />
                );
              }
              // Longer ticks for action items and decisions; both on one line: two, just apart.
              return marked.map((marker, index) => (
                <button
                  key={`${line}-${marker.kind}`}
                  type="button"
                  aria-label={`Line ${line}: ${marker.label}`}
                  title={`Line ${line} · ${marker.label}`}
                  // Don't start a drag when pressing a tick.
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => goToLine(line)}
                  style={{
                    top: `calc(${top * 100}% + ${(index - (marked.length - 1) / 2) * 5}px)`,
                  }}
                  // A taller invisible hit area (py) makes the 2px tick easy to click.
                  className="group/tick absolute right-0 -translate-y-1/2 py-1"
                >
                  <span
                    className={cn(
                      'block h-0.5 w-5 rounded-pill transition-[width,opacity] group-hover/tick:w-6 group-focus-visible/tick:w-6',
                      marker.kind === 'action' ? 'bg-accent' : 'bg-success',
                      !onScreen && 'opacity-60',
                    )}
                  />
                </button>
              ));
            })}
        </div>
      </nav>
    </PanelOverlay>
  );
}
