import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { PanelOverlay } from '@/components/layout/PageBar';
import { cn } from '@/lib/cn';

export type MapMarker = { line: number; kind: 'action' | 'decision'; label: string };

type Geometry = {
  /** Where the visible part of the page starts, and how much of it shows (0–1 of the page). */
  thumbTop: number;
  thumbHeight: number;
  /** Each marked line's position (0–1 of the page). */
  tops: Record<number, number>;
};

const smooth = (): ScrollBehavior =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

/**
 * A slim map of the transcript on the right edge of the frame (desktop): a hairline track with a
 * dot for each line that has an action item (cobalt) or a decision (green), and a soft thumb for
 * the part on screen. Click or drag along it to move through the transcript; click a dot to jump
 * to that line. It stays faint until hovered, so it doesn't compete with the text.
 *
 * It lives on the panel overlay (fixed while the page scrolls) and follows the shell's scrolling
 * area, measuring where each marked line really is (rows with cards are taller than others).
 */
export function TranscriptMap({
  listRef,
  markers,
}: {
  listRef: RefObject<HTMLElement | null>;
  markers: MapMarker[];
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const scroller = () => listRef.current?.closest<HTMLElement>('[data-scroller]') ?? null;

  useEffect(() => {
    const list = listRef.current;
    const area = list?.closest<HTMLElement>('[data-scroller]');
    if (!list || !area) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const total = area.scrollHeight || 1;
        const viewTop = area.getBoundingClientRect().top;
        const tops: Record<number, number> = {};
        for (const marker of markers) {
          const row = document.getElementById(`L${marker.line}`);
          if (row)
            tops[marker.line] =
              (row.getBoundingClientRect().top - viewTop + area.scrollTop) / total;
        }
        setGeometry({
          thumbTop: area.scrollTop / total,
          thumbHeight: area.clientHeight / total,
          tops,
        });
      });
    };
    measure();
    area.addEventListener('scroll', measure, { passive: true });
    // Re-measure when the transcript or the panel changes size (every browser has
    // ResizeObserver; the test environment doesn't, so it's optional).
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    resize?.observe(list);
    resize?.observe(area);
    return () => {
      cancelAnimationFrame(frame);
      area.removeEventListener('scroll', measure);
      resize?.disconnect();
    };
  }, [listRef, markers]);

  // Centre the transcript on the point of the track under the pointer.
  const scrollToPointer = (clientY: number) => {
    const rail = railRef.current?.getBoundingClientRect();
    const area = scroller();
    if (!rail || !area) return;
    const at = Math.min(1, Math.max(0, (clientY - rail.top) / rail.height));
    area.scrollTo({ top: at * area.scrollHeight - area.clientHeight / 2 });
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Keep following the pointer while dragging, even off the track (optional in tests).
    event.currentTarget.setPointerCapture?.(event.pointerId);
    scrollToPointer(event.clientY);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) scrollToPointer(event.clientY);
  };
  // A line with both a decision and an action item gets two dots: nudge them apart (decision
  // just above, action just below) so neither hides the other.
  const shared = new Set(
    markers
      .filter((m) => m.kind === 'decision')
      .map((m) => m.line)
      .filter((line) => markers.some((m) => m.kind === 'action' && m.line === line)),
  );
  const goToLine = (line: number) =>
    document.getElementById(`L${line}`)?.scrollIntoView?.({ block: 'center', behavior: smooth() });

  return (
    <PanelOverlay>
      <nav
        aria-label="Transcript map"
        className="pointer-events-auto absolute top-12 right-2 bottom-12 w-5 opacity-60 transition-opacity duration-200 focus-within:opacity-100 hover:opacity-100"
      >
        {/* The track: click or drag to move. Wheel scrolling over it still scrolls the page. */}
        <div
          ref={railRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onWheel={(event) => scroller()?.scrollBy({ top: event.deltaY })}
          className="relative h-full w-full cursor-pointer touch-none"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 rounded-pill bg-line-strong/50"
          />
          {geometry && (
            <>
              {/* "You are here": the part of the transcript on screen. Position is measured. */}
              <span
                aria-hidden="true"
                className="absolute left-1/2 w-1 -translate-x-1/2 rounded-pill bg-fg/25"
                style={{
                  top: `${geometry.thumbTop * 100}%`,
                  height: `${Math.max(geometry.thumbHeight * 100, 4)}%`,
                }}
              />
              {markers.map((marker) =>
                geometry.tops[marker.line] === undefined ? null : (
                  <button
                    key={`${marker.line}-${marker.kind}`}
                    type="button"
                    aria-label={`Line ${marker.line}: ${marker.label}`}
                    title={`Line ${marker.line} · ${marker.label}`}
                    // Don't start a track drag when pressing a dot.
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => goToLine(marker.line)}
                    style={{ top: `${geometry.tops[marker.line]! * 100}%` }}
                    className={cn(
                      'absolute left-1/2 size-2 -translate-x-1/2 rounded-pill ring-2 ring-bg transition-transform hover:scale-150 focus-visible:scale-150',
                      marker.kind === 'action' ? 'bg-accent' : 'bg-success',
                      !shared.has(marker.line)
                        ? '-translate-y-1/2'
                        : marker.kind === 'decision'
                          ? '-translate-y-[calc(50%+5px)]'
                          : '-translate-y-[calc(50%-5px)]',
                    )}
                  />
                ),
              )}
            </>
          )}
        </div>
      </nav>
    </PanelOverlay>
  );
}
