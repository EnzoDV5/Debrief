// The app's dropdown, used instead of the browser's own <select> so it matches the rest of the
// design. A button opens a floating list; arrows, Enter, Escape, Home/End and typing a letter all
// work, and it opens upwards when there isn't room below.
import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

export type SelectOption<T extends string> = { value: T; label: string; icon?: ReactNode };

const LIST_MAX_HEIGHT = 288;

type Popup = {
  style: { left: number; minWidth: number; top?: number; bottom?: number };
  container: Element;
};

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  showLabel = false,
  tone = 'light',
  id,
  className,
  'aria-invalid': invalid,
  'aria-describedby': describedBy,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  label: string;
  // Show the label inside the button ("Owner  Everyone") instead of only to screen readers.
  showLabel?: boolean;
  // 'bar' suits the dark top bar on wide screens.
  tone?: 'light' | 'bar';
  id?: string;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const ownId = useId();
  const buttonId = id ?? ownId;
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [active, setActive] = useState(0);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];

  const close = (refocus = true) => {
    setPopup(null);
    if (refocus) button.current?.focus();
  };
  const open = () => {
    const box = button.current?.getBoundingClientRect();
    if (!button.current || !box) return;
    const below = window.innerHeight - box.bottom;
    setActive(selectedIndex);
    setPopup({
      style: {
        left: box.left,
        minWidth: box.width,
        ...(below < LIST_MAX_HEIGHT && box.top > below
          ? { bottom: window.innerHeight - box.top + 6 }
          : { top: box.bottom + 6 }),
      },
      container: button.current.closest('dialog') ?? document.body,
    });
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    close();
  };

  useEffect(() => {
    if (!popup) return;
    list.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!list.current?.contains(target) && !button.current?.contains(target)) close(false);
    };
    const onScroll = (event: Event) => {
      if (!list.current?.contains(event.target as Node)) close(false);
    };
    const onResize = () => close(false);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [popup]);

  useEffect(() => {
    if (popup)
      document
        .getElementById(`${buttonId}-option-${active}`)
        ?.scrollIntoView?.({ block: 'nearest' });
  }, [active, popup, buttonId]);

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      open();
    }
  };
  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]!);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      close(false);
    } else if (event.key.length === 1) {
      // Jump to the next option starting with the typed letter.
      const letter = event.key.toLowerCase();
      const order = [...options.keys()].map((i) => (active + 1 + i) % options.length);
      const match = order.find((i) => options[i]!.label.toLowerCase().startsWith(letter));
      if (match !== undefined) setActive(match);
    }
  };

  return (
    <>
      <button
        ref={button}
        id={buttonId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={popup !== null}
        aria-label={`${label}, ${selected?.label ?? ''}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (popup ? close() : open())}
        onKeyDown={onButtonKeyDown}
        className={cn(
          'group inline-flex min-h-10 items-center gap-2 rounded-pill border pr-3 pl-4 text-sm font-semibold transition-[background-color,border-color,box-shadow] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
          'border-line-strong/50 bg-surface text-fg shadow-card hover:border-fg/40',
          tone === 'bar' &&
            'lg:border-sidebar-line lg:bg-sidebar-hover lg:text-sidebar-fg lg:shadow-none lg:hover:border-sidebar-muted lg:hover:bg-sidebar-active',
          popup && 'border-accent ring-2 ring-accent/25 lg:border-accent',
          invalid && 'border-danger',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {showLabel && (
            <span
              className={cn('font-medium text-muted', tone === 'bar' && 'lg:text-sidebar-muted')}
            >
              {label}
            </span>
          )}
          {selected?.icon && (
            <span aria-hidden="true" className="shrink-0 [&>svg]:size-4">
              {selected.icon}
            </span>
          )}
          <span className="truncate">{selected?.label}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'ml-auto size-4 shrink-0 opacity-60 transition-transform duration-200',
            popup && 'rotate-180',
          )}
        />
      </button>

      {popup &&
        createPortal(
          <ul
            ref={list}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={`${buttonId}-option-${active}`}
            onKeyDown={onListKeyDown}
            style={{ ...popup.style, maxHeight: LIST_MAX_HEIGHT }}
            className={cn(
              'fixed z-[60] scrollbar-soft overflow-y-auto rounded-card border border-white/70 glass-float p-1.5 text-fg shadow-raised outline-none motion-safe:animate-search-in',
              popup.style.bottom !== undefined ? 'origin-bottom' : 'origin-top',
            )}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${buttonId}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(index)}
                  className={cn(
                    'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-3 text-sm whitespace-nowrap transition-colors',
                    index === active ? 'bg-accent-soft text-accent' : 'text-fg',
                    isSelected && 'font-semibold',
                  )}
                >
                  {option.icon && (
                    <span aria-hidden="true" className="shrink-0 [&>svg]:size-4">
                      {option.icon}
                    </span>
                  )}
                  <span className="flex-1">{option.label}</span>
                  <Check
                    aria-hidden="true"
                    className={cn('size-4 shrink-0', isSelected ? 'text-accent' : 'invisible')}
                  />
                </li>
              );
            })}
          </ul>,
          popup.container,
        )}
    </>
  );
}
