// The meeting lists in the sidebar (Pinned, Recent, Archived).
// - Drag a meeting to reorder its own section: press and drag (press and hold on touch screens).
//   The meeting (looking just as it does in the list) follows the pointer anywhere on screen
//   while the other meetings in its section slide apart to make room; on release it glides into
//   the gap and the order is saved.
//   Alt + Up/Down does the same from the keyboard.
// - A deleted meeting fades out on top of the list while the rows below glide up once.
import type { MeetingListItem } from '@debrief/shared';
import { useQueryClient } from '@tanstack/react-query';
import { CircleAlert, LoaderCircle, MoreHorizontal } from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router';
import { cn } from '@/lib/cn';
import { fixedFrame, type Box } from '@/lib/floating';
import { useFreshMeetings } from './analysisWatch';
import { meetingKeys, usePrefetchMeeting, useReorderMeetings } from './hooks';
import { MeetingMenu } from './MeetingMenu';
import { useListMotion } from './useListMotion';

const DRAG_THRESHOLD = 5;
const LONG_PRESS_MS = 350;
const GHOST_MS = 220;
const DROP_MS = 200;

type Press = {
  id: string;
  pointerId: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  order: string[];
  active: boolean;
  dropping: boolean;
  timer?: number;
};

type Handlers = {
  onMove: (event: PointerEvent) => void;
  onUp: (event: PointerEvent) => void;
  onCancel: () => void;
  onKey: (event: globalThis.KeyboardEvent) => void;
};

type Drag = { id: string; order: string[]; rect: DOMRect; frame: Box; container: Element };

export function SidebarMeetingList({
  meetings,
  onNavigate,
  reorderable = false,
}: {
  meetings: MeetingListItem[];
  onNavigate?: () => void;
  reorderable?: boolean;
}) {
  const prefetch = usePrefetchMeeting();
  const motionRef = useListMotion();
  const fresh = useFreshMeetings();
  const saveOrder = useReorderMeetings();
  const queryClient = useQueryClient();
  const ids = meetings.map((meeting) => meeting.id);

  const listRef = useRef<HTMLUListElement>(null);
  const rowEls = useRef(new Map<string, HTMLElement>());
  const ghostEls = useRef(new Map<string, HTMLElement>());
  const tops = useRef(new Map<string, number>());
  const press = useRef<Press | null>(null);
  const clone = useRef<HTMLDivElement>(null);
  const justDragged = useRef(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [announcement, setAnnouncement] = useState('');

  // ---- Deleted meetings: a "ghost" that fades out on top of the list (it takes no space, so the
  // rows below only move once, gliding up). Meetings that merely moved list just glide there.
  const [previous, setPrevious] = useState(meetings);
  const [ghosts, setGhosts] = useState<MeetingListItem[]>([]);
  if (previous !== meetings) {
    const known = new Set(
      [meetingKeys.list, meetingKeys.filtered({ archived: true })]
        .flatMap((key) => queryClient.getQueryData<MeetingListItem[]>(key) ?? [])
        .map((m) => m.id),
    );
    const gone = previous.filter(
      (meeting) => !meetings.some((m) => m.id === meeting.id) && !known.has(meeting.id),
    );
    // Replace rather than append: React may run this render twice in development.
    if (gone.length)
      setGhosts((current) => [...current.filter((g) => !gone.some((m) => m.id === g.id)), ...gone]);
    setPrevious(meetings);
  }
  useEffect(() => {
    if (!ghosts.length) return;
    const timer = window.setTimeout(() => setGhosts([]), GHOST_MS);
    return () => window.clearTimeout(timer);
  }, [ghosts]);

  // Put each ghost where its row was, then remember where every row is now.
  useLayoutEffect(() => {
    // Each ghost is placed once, when it first appears; later renders must not move it.
    for (const [id, el] of ghostEls.current) {
      if (el.dataset.placed) continue;
      el.style.top = `${tops.current.get(id) ?? 0}px`;
      el.dataset.placed = 'true';
    }
    tops.current = new Map([...rowEls.current].map(([id, el]) => [id, el.offsetTop]));
  });

  // The floating copy keeps its offset from the pointer across re-renders.
  useLayoutEffect(() => {
    const p = press.current;
    if (clone.current && p) clone.current.style.translate = `${p.dx}px ${p.dy}px`;
  }, [drag]);

  // ---- Drag to reorder ----
  // Window listeners must be the same functions when added and removed, so these stay fixed for
  // the component's life and call whichever handlers belong to the latest render.
  const latest = useRef<Handlers | null>(null);
  const [listeners] = useState(() => ({
    move: (event: PointerEvent) => latest.current?.onMove(event),
    up: (event: PointerEvent) => latest.current?.onUp(event),
    cancel: () => latest.current?.onCancel(),
    key: (event: globalThis.KeyboardEvent) => latest.current?.onKey(event),
    blockScroll: (event: TouchEvent) => event.preventDefault(),
  }));

  const cleanup = () => {
    const p = press.current;
    if (p?.timer) window.clearTimeout(p.timer);
    press.current = null;
    window.removeEventListener('pointermove', listeners.move);
    window.removeEventListener('pointerup', listeners.up);
    window.removeEventListener('pointercancel', listeners.cancel);
    window.removeEventListener('keydown', listeners.key);
    document.removeEventListener('touchmove', listeners.blockScroll);
    document.body.classList.remove('select-none', 'cursor-grabbing');
  };
  // If the list disappears mid-drag (e.g. the drawer closes), don't leave listeners behind.
  useEffect(() => () => latest.current?.onCancel(), []);

  const activate = () => {
    const p = press.current;
    const el = p && rowEls.current.get(p.id);
    if (!p || !el || p.active) return;
    p.active = true;
    document.addEventListener('touchmove', listeners.blockScroll, { passive: false });
    document.body.classList.add('select-none', 'cursor-grabbing');
    const container = el.closest('dialog') ?? document.body;
    setDrag({
      id: p.id,
      order: p.order,
      rect: el.getBoundingClientRect(),
      frame: fixedFrame(container),
      container,
    });
  };

  // Where the dragged meeting belongs: compared with the other rows' midpoints from the layout
  // (offsetTop), so rows that are still gliding don't make the target jump. Above the section it
  // goes first, below it goes last: other sections are never affected.
  const orderFor = (p: Press, clientY: number) => {
    const list = listRef.current;
    if (!list) return p.order;
    const top = list.getBoundingClientRect().top;
    const others = p.order.filter((id) => id !== p.id);
    let index = 0;
    for (const id of others) {
      const el = rowEls.current.get(id);
      if (el && clientY > top + el.offsetTop + el.offsetHeight / 2) index++;
    }
    const next = [...others];
    next.splice(index, 0, p.id);
    return next;
  };

  function onMove(event: PointerEvent) {
    const p = press.current;
    if (!p || p.dropping || event.pointerId !== p.pointerId) return;
    p.dx = event.clientX - p.x;
    p.dy = event.clientY - p.y;
    if (!p.active) {
      if (Math.hypot(p.dx, p.dy) < DRAG_THRESHOLD) return;
      // On touch, moving before the long press means the user is scrolling.
      if (event.pointerType === 'touch') return cleanup();
      activate();
    }
    if (clone.current) clone.current.style.translate = `${p.dx}px ${p.dy}px`;
    const next = orderFor(p, event.clientY);
    if (next.join() !== p.order.join()) {
      p.order = next;
      setDrag((current) => (current ? { ...current, order: next } : current));
    }
  }

  function finish(save: boolean) {
    const p = press.current;
    if (!p) return;
    if (save && p && p.order.join() !== ids.join()) saveOrder(p.order);
    setDrag(null);
    cleanup();
  }

  function onUp(event: PointerEvent) {
    const p = press.current;
    if (!p || event.pointerId !== p.pointerId) return;
    if (!p.active) return cleanup();
    // The release ends with a click on whatever is underneath: don't let it open a meeting.
    justDragged.current = true;
    window.setTimeout(() => (justDragged.current = false), 0);
    // Glide the floating copy into its gap, then drop it there.
    p.dropping = true;
    const slot = rowEls.current.get(p.id)?.getBoundingClientRect();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (!clone.current || !slot || !drag || reduce) return finish(true);
    const animation = clone.current.animate?.(
      [
        { translate: `${p.dx}px ${p.dy}px` },
        { translate: `${slot.left - drag.rect.left}px ${slot.top - drag.rect.top}px` },
      ],
      { duration: DROP_MS, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'forwards' },
    );
    if (!animation) return finish(true);
    animation.onfinish = () => finish(true);
  }

  function onCancel() {
    finish(false);
  }

  function onKey(event: globalThis.KeyboardEvent) {
    if (event.key === 'Escape') finish(false);
  }

  const onRowPointerDown = (meeting: MeetingListItem, event: ReactPointerEvent) => {
    if (!reorderable || meetings.length < 2 || press.current) return;
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    press.current = {
      id: meeting.id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dx: 0,
      dy: 0,
      order: ids,
      active: false,
      dropping: false,
    };
    if (event.pointerType === 'touch')
      press.current.timer = window.setTimeout(activate, LONG_PRESS_MS);
    window.addEventListener('pointermove', listeners.move);
    window.addEventListener('pointerup', listeners.up);
    window.addEventListener('pointercancel', listeners.cancel);
    window.addEventListener('keydown', listeners.key);
  };

  // Keyboard: Alt + Up/Down moves the focused meeting one place.
  const onRowKeyDown = (meeting: MeetingListItem, event: KeyboardEvent) => {
    if (!reorderable || !event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown'))
      return;
    event.preventDefault();
    const from = ids.indexOf(meeting.id);
    const to = from + (event.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, meeting.id);
    saveOrder(next);
    setAnnouncement(`Moved “${meeting.title}” to position ${to + 1} of ${ids.length}.`);
  };

  // Keep the fixed window listeners pointing at this render's handlers.
  useLayoutEffect(() => {
    latest.current = { onMove, onUp, onCancel, onKey };
  });

  const shown = drag
    ? drag.order
        .map((id) => meetings.find((meeting) => meeting.id === id))
        .filter((meeting) => meeting !== undefined)
    : meetings;
  const dragged = drag && meetings.find((meeting) => meeting.id === drag.id);

  return (
    <ul ref={listRef} className="relative space-y-0.5">
      {shown.map((meeting) => (
        <MeetingRow
          key={meeting.id}
          ref={(el) => {
            motionRef(meeting.id)(el);
            if (el) rowEls.current.set(meeting.id, el);
            else rowEls.current.delete(meeting.id);
          }}
          meeting={meeting}
          isNew={fresh.has(meeting.id)}
          placeholder={drag?.id === meeting.id}
          reorderable={reorderable && meetings.length > 1}
          onNavigate={onNavigate}
          onPrefetch={() => prefetch(meeting.id)}
          onPointerDown={(event) => onRowPointerDown(meeting, event)}
          onKeyDown={(event) => onRowKeyDown(meeting, event)}
          onClickCapture={(event) => {
            if (!justDragged.current) return;
            event.preventDefault();
            event.stopPropagation();
          }}
        />
      ))}
      {ghosts.map((meeting) => (
        <li
          key={`ghost-${meeting.id}`}
          ref={(el) => {
            if (el) ghostEls.current.set(meeting.id, el);
            else ghostEls.current.delete(meeting.id);
          }}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 truncate rounded-md px-3 py-2 text-sm text-sidebar-fg motion-safe:animate-ghost-out"
        >
          {meeting.title}
        </li>
      ))}
      <li role="presentation" className="sr-only" aria-live="polite">
        {announcement}
      </li>
      {drag &&
        dragged &&
        createPortal(
          <div
            ref={clone}
            aria-hidden="true"
            style={{
              left: drag.rect.left - drag.frame.left,
              top: drag.rect.top - drag.frame.top,
              width: drag.rect.width,
            }}
            className="pointer-events-none fixed z-80 flex items-center rounded-md bg-sidebar-hover text-sm text-sidebar-fg"
          >
            <span className="min-h-10 min-w-0 flex-1 truncate px-3 py-2 leading-6">
              {dragged.title}
            </span>
            <span className="grid size-8 shrink-0 place-items-center text-sidebar-muted">
              <MoreHorizontal className="size-4" />
            </span>
          </div>,
          drag.container,
        )}
    </ul>
  );
}

// One meeting in the sidebar. While it's being analysed it shows a spinner and a shimmering
// title (you can keep using the app meanwhile); when it's done it stands out with a "New" tag
// until you open it. While it's being dragged, its spot is left as an empty gap.
function MeetingRow({
  ref,
  meeting,
  isNew,
  placeholder,
  reorderable,
  onNavigate,
  onPrefetch,
  onPointerDown,
  onKeyDown,
  onClickCapture,
}: {
  ref: (el: HTMLElement | null) => void;
  meeting: MeetingListItem;
  isNew: boolean;
  placeholder: boolean;
  reorderable: boolean;
  onNavigate?: () => void;
  onPrefetch: () => void;
  onPointerDown: (event: ReactPointerEvent) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onClickCapture: (event: React.MouseEvent) => void;
}) {
  const analysing = meeting.analysisStatus === 'pending' || meeting.analysisStatus === 'processing';
  const statusId = useId();
  const failed = meeting.analysisStatus === 'failed';
  const status = analysing
    ? 'Analysing'
    : failed
      ? 'Analysis failed'
      : isNew
        ? 'New results'
        : null;
  return (
    <li
      ref={ref}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
      className={cn(
        'relative flex items-center rounded-md transition-colors duration-500 hover:bg-sidebar-hover',
        isNew && 'bg-spark/10 ring-1 ring-spark/30 ring-inset',
        placeholder && '*:invisible hover:bg-transparent',
      )}
    >
      <NavLink
        to={`/meetings/${meeting.id}`}
        onClick={onNavigate}
        onPointerEnter={onPrefetch}
        onFocus={onPrefetch}
        onKeyDown={onKeyDown}
        draggable={false}
        title={
          reorderable ? `${meeting.title} (drag to reorder, or Alt + arrow keys)` : meeting.title
        }
        aria-describedby={status ? statusId : undefined}
        className={({ isActive }) =>
          cn(
            'flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
            isActive ? 'bg-sidebar-active text-white' : 'text-sidebar-fg hover:bg-sidebar-hover',
            isNew && 'font-semibold text-white',
            failed && 'text-danger-light',
          )
        }
      >
        {analysing && (
          <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin text-spark" />
        )}
        {failed && <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-danger-light" />}
        {isNew && !analysing && (
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-pill bg-spark motion-safe:animate-pulse"
          />
        )}
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            analysing &&
              'ai-shimmer-text [--shimmer-base:var(--color-sidebar-muted)] [--shimmer-hi:#fff]',
          )}
        >
          {meeting.title}
        </span>
        {isNew && !analysing && (
          <span
            aria-hidden="true"
            className="shrink-0 rounded-pill bg-spark px-1.5 text-[0.6875rem] leading-5 font-bold text-fg"
          >
            New
          </span>
        )}
      </NavLink>
      {status && (
        <span id={statusId} className="sr-only">
          {status}
        </span>
      )}
      <MeetingMenu meeting={meeting} />
    </li>
  );
}
