// A date field with our own calendar, because the browser's date pop-up can't be styled.
// The field is a button showing the date in words; it opens a month grid (Monday first) that
// works like the other dropdowns: it opens inside pop-ups, flips upwards when there's no room,
// and closes on Escape or a click outside. Keyboard: arrows move a day/week, Home/End go to the
// start/end of the week, Page Up/Down change month, Enter picks.
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { fixedFrame } from '@/lib/floating';
import { formatCalendarDate, formatLongCalendarDate, todayDate } from '@/lib/format';

// Dates are 'YYYY-MM-DD' strings throughout, worked out in UTC so a time zone can't shift a day.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const toDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const toYmd = (date: Date) => date.toISOString().slice(0, 10);

export function addDays(ymd: string, days: number): string {
  const date = toDate(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return toYmd(date);
}

// Same day next/previous month, or that month's last day (31 Jan + 1 month = 28/29 Feb).
function addMonths(ymd: string, months: number): string {
  const date = toDate(ymd);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return toYmd(date);
}

// Monday = 0 ... Sunday = 6.
const weekday = (ymd: string) => (toDate(ymd).getUTCDay() + 6) % 7;

// Always 6 weeks, so the calendar keeps the same height from month to month.
function monthGrid(ymd: string): string[] {
  const first = `${ymd.slice(0, 8)}01`;
  const start = addDays(first, -weekday(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

const monthTitle = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const WEEKDAYS = [
  ['Mo', 'Monday'],
  ['Tu', 'Tuesday'],
  ['We', 'Wednesday'],
  ['Th', 'Thursday'],
  ['Fr', 'Friday'],
  ['Sa', 'Saturday'],
  ['Su', 'Sunday'],
] as const;

export type DateShortcut = { label: string; value: string };

// One-click dates under the calendar.
export function dueDateShortcuts(today = todayDate()): DateShortcut[] {
  return [
    { label: 'Today', value: today },
    { label: 'Tomorrow', value: addDays(today, 1) },
    { label: 'Next Monday', value: addDays(today, 7 - weekday(today)) },
  ];
}
export function meetingDateShortcuts(today = todayDate()): DateShortcut[] {
  return [
    { label: 'Today', value: today },
    { label: 'Yesterday', value: addDays(today, -1) },
  ];
}

const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 390;

type Popup = {
  style: { left: number; top?: number; bottom?: number };
  container: Element;
};

export function DatePicker({
  id,
  value,
  onChange,
  onBlur,
  buttonRef,
  shortcuts = [],
  clearable = false,
  placeholder = 'Pick a date',
  tone = 'light',
  className,
  'aria-invalid': invalid,
  'aria-describedby': describedBy,
}: {
  // The field's id. Its label is expected at `${id}-label` (our Field gives it that id).
  id: string;
  // 'YYYY-MM-DD', or '' for no date.
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  // React Hook Form's field.ref, so a validation error can focus the field.
  buttonRef?: (node: HTMLButtonElement | null) => void;
  shortcuts?: DateShortcut[];
  // Shows "Clear" for optional dates.
  clearable?: boolean;
  placeholder?: string;
  // 'bar': the dark top bar on wide screens.
  tone?: 'light' | 'bar';
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const titleId = useId();
  const button = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<Popup | null>(null);
  const selected = ISO_DATE.test(value) ? value : null;
  const today = todayDate();
  // The day the keyboard is on. The calendar shows its month.
  const [cursor, setCursor] = useState(selected ?? today);
  // Move real focus to the cursor day only after opening or a key press in the grid, not when
  // the month arrows are clicked (focus stays on the arrow for repeated clicks).
  const focusCursor = useRef(false);

  const open = () => {
    const box = button.current?.getBoundingClientRect();
    if (!button.current || !box) return;
    // Inside a pop-up the calendar must live in it to show; "frame" is what fixed is measured from.
    const container = button.current.closest('dialog') ?? document.body;
    const frame = fixedFrame(container);
    const below = window.innerHeight - box.bottom;
    setCursor(selected ?? today);
    focusCursor.current = true;
    setPopup({
      style: {
        // Lined up with the field, but never past the right edge.
        left: Math.max(
          8,
          Math.min(box.left - frame.left, frame.right - frame.left - PANEL_WIDTH - 8),
        ),
        ...(below < PANEL_HEIGHT && box.top > below
          ? { bottom: frame.bottom - box.top + 6 }
          : { top: box.bottom - frame.top + 6 }),
      },
      container,
    });
  };
  const close = (refocus = true) => {
    setPopup(null);
    if (refocus) button.current?.focus();
    onBlur?.();
  };
  const pick = (ymd: string) => {
    onChange(ymd);
    close();
  };

  useEffect(() => {
    if (!popup || !focusCursor.current) return;
    focusCursor.current = false;
    panel.current?.querySelector<HTMLButtonElement>(`[data-day="${cursor}"]`)?.focus();
  }, [popup, cursor]);

  useEffect(() => {
    if (!popup) return;
    // A click outside, a scroll or a resize just closes it; focus stays where the user put it.
    const dismiss = () => setPopup(null);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) dismiss();
    };
    const onScroll = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) dismiss();
    };
    const onResize = dismiss;
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [popup]);

  const onDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      Home: () => addDays(cursor, -weekday(cursor)),
      End: () => addDays(cursor, 6 - weekday(cursor)),
      PageUp: () => addMonths(cursor, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(cursor, event.shiftKey ? 12 : 1),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    focusCursor.current = true;
    setCursor(move());
  };

  const days = monthGrid(cursor);
  const month = cursor.slice(0, 7);

  return (
    <>
      <button
        ref={(node) => {
          button.current = node;
          buttonRef?.(node);
        }}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={popup !== null}
        // "Due date (optional) Wed, 25 Nov 2026": the label and the date.
        aria-labelledby={`${id}-label ${id}-value`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (popup ? close() : open())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !popup) {
            event.preventDefault();
            open();
          }
        }}
        className={cn(
          'flex min-h-11 w-full items-center gap-2.5 rounded-md border border-line-strong bg-surface bg-clip-padding px-3 text-left text-base text-fg',
          'transition-colors duration-150 hover:border-fg/60 focus-visible:outline-offset-0 focus-visible:outline-accent',
          'aria-invalid:border-danger aria-invalid:focus-visible:outline-danger',
          popup && 'border-accent',
          tone === 'bar' &&
            'lg:border-sidebar-line lg:bg-sidebar-hover lg:text-sidebar-strong lg:hover:border-sidebar-strong/50 lg:aria-invalid:border-danger-light',
          tone === 'bar' && popup && 'lg:border-sidebar-strong',
          className,
        )}
      >
        <CalendarDays
          aria-hidden="true"
          className={cn('size-4 shrink-0 text-muted', tone === 'bar' && 'lg:text-sidebar-muted')}
        />
        <span
          id={`${id}-value`}
          className={cn(
            'truncate',
            !selected && 'text-muted',
            !selected && tone === 'bar' && 'lg:text-sidebar-muted',
          )}
        >
          {selected ? formatCalendarDate(selected) : placeholder}
        </span>
      </button>

      {popup &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label="Choose a date"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                // Close just the calendar, not the pop-up it sits in.
                event.preventDefault();
                event.stopPropagation();
                close();
              }
            }}
            onBlur={(event) => {
              // Tabbing out of the calendar closes it.
              if (
                event.relatedTarget &&
                !panel.current?.contains(event.relatedTarget as Node) &&
                event.relatedTarget !== button.current
              ) {
                close(false);
              }
            }}
            style={{ ...popup.style, width: PANEL_WIDTH }}
            className={cn(
              'fixed z-[60] rounded-card border border-line bg-surface p-3 text-fg shadow-raised motion-safe:animate-search-in',
              popup.style.bottom !== undefined ? 'origin-bottom' : 'origin-top',
            )}
          >
            <div className="flex items-center justify-between pb-2">
              <MonthButton label="Previous month" onClick={() => setCursor(addMonths(cursor, -1))}>
                <ChevronLeft aria-hidden="true" className="size-4" />
              </MonthButton>
              <p id={titleId} aria-live="polite" className="text-sm font-semibold">
                {monthTitle.format(toDate(cursor))}
              </p>
              <MonthButton label="Next month" onClick={() => setCursor(addMonths(cursor, 1))}>
                <ChevronRight aria-hidden="true" className="size-4" />
              </MonthButton>
            </div>

            <table role="grid" aria-labelledby={titleId} className="w-full border-collapse">
              <thead>
                <tr>
                  {WEEKDAYS.map(([short, long]) => (
                    <th
                      key={short}
                      scope="col"
                      abbr={long}
                      className="pb-1 text-center text-xs font-semibold text-muted"
                    >
                      {short}
                    </th>
                  ))}
                </tr>
              </thead>
              {/* Keyed by month, so a new month fades in. */}
              <tbody key={month} className="motion-safe:animate-fade-in">
                {Array.from({ length: 6 }, (_, week) => (
                  <tr key={week}>
                    {days.slice(week * 7, week * 7 + 7).map((day) => {
                      const isSelected = day === selected;
                      const isToday = day === today;
                      const inMonth = day.startsWith(month);
                      return (
                        <td key={day} className="p-0.5 text-center">
                          <button
                            type="button"
                            data-day={day}
                            tabIndex={day === cursor ? 0 : -1}
                            aria-label={formatLongCalendarDate(day)}
                            aria-pressed={isSelected}
                            aria-current={isToday ? 'date' : undefined}
                            onClick={() => pick(day)}
                            onKeyDown={onDayKeyDown}
                            onFocus={() => setCursor(day)}
                            className={cn(
                              'mx-auto grid size-9 place-items-center rounded-pill text-sm tabular-nums transition-colors duration-150 outline-none',
                              'focus-visible:ring-2 focus-visible:ring-accent/60',
                              inMonth ? 'text-fg' : 'text-muted/60',
                              isToday &&
                                !isSelected &&
                                'font-semibold text-accent ring-1 ring-accent/40',
                              isSelected
                                ? 'bg-accent font-semibold text-accent-fg shadow-card'
                                : 'hover:bg-accent-soft hover:text-accent',
                            )}
                          >
                            {Number(day.slice(8))}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {(shortcuts.length > 0 || (clearable && selected)) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                {shortcuts.map((shortcut) => (
                  <button
                    key={shortcut.label}
                    type="button"
                    onClick={() => pick(shortcut.value)}
                    className={cn(
                      'inline-flex min-h-7 items-center rounded-pill border px-2.5 text-xs font-medium transition-colors duration-150',
                      shortcut.value === selected
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line-strong bg-surface text-fg hover:border-accent hover:text-accent',
                    )}
                  >
                    {shortcut.label}
                  </button>
                ))}
                {clearable && selected && (
                  <button
                    type="button"
                    onClick={() => pick('')}
                    className="ml-auto inline-flex min-h-7 items-center rounded-pill px-2.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>,
          popup.container,
        )}
    </>
  );
}

function MonthButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-pill text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
