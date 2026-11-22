// A name box with a dropdown of suggested people: type any name, or open the list (▾ button or
// arrow down) and pick one. Typing narrows the list. Built like our Select (same floating list,
// works inside pop-ups) because the browser's own <datalist> hid every name that didn't match what
// was already typed, so its arrow looked broken.
import { Check, ChevronDown, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { fixedFrame } from '@/lib/floating';
import { Initials } from './Initials';

const LIST_MAX_HEIGHT = 240;

type Popup = {
  style: { left: number; width: number; top?: number; bottom?: number };
  container: Element;
};

export function NameCombobox({
  id,
  value,
  onChange,
  onBlur,
  names,
  listLabel,
  placeholder,
  autoFocus,
  maxLength,
  inputRef,
  onKeyDown,
  className,
  'aria-invalid': invalid,
  'aria-describedby': describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  names: string[];
  // What the list is, for screen readers and the ▾ button ("People in this meeting").
  listLabel: string;
  placeholder?: string;
  autoFocus?: boolean;
  maxLength?: number;
  inputRef?: Ref<HTMLInputElement>;
  // Keys the combobox doesn't use itself (e.g. Escape with the list closed) go to the parent.
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const listId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [popup, setPopup] = useState<Popup | null>(null);
  // -1: nothing highlighted, so Enter still submits the form with what was typed.
  const [active, setActive] = useState(-1);

  const typed = value.trim().toLowerCase();
  const isListed = names.some((name) => name.toLowerCase() === typed);
  // A listed name in the box shows everyone (easy to switch); a new name narrows the list.
  const shown =
    typed && !isListed ? names.filter((name) => name.toLowerCase().includes(typed)) : names;
  const isOpen = popup !== null && shown.length > 0;

  const open = () => {
    const box = wrapper.current?.getBoundingClientRect();
    if (!wrapper.current || !box) return;
    const below = window.innerHeight - box.bottom;
    // Inside a pop-up the list must live in it to show; "frame" is what fixed is measured from.
    const container = wrapper.current.closest('dialog') ?? document.body;
    const frame = fixedFrame(container);
    setPopup({
      style: {
        left: box.left - frame.left,
        width: box.width,
        ...(below < LIST_MAX_HEIGHT && box.top > below
          ? { bottom: frame.bottom - box.top + 6 }
          : { top: box.bottom - frame.top + 6 }),
      },
      container,
    });
  };
  const close = () => {
    setPopup(null);
    setActive(-1);
  };
  const pick = (name: string) => {
    onChange(name);
    close();
  };

  useEffect(() => {
    if (!popup) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!list.current?.contains(target) && !wrapper.current?.contains(target)) close();
    };
    const onScroll = (event: Event) => {
      if (!list.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [popup]);

  useEffect(() => {
    if (isOpen && active >= 0)
      document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, isOpen, listId]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const last = shown.length - 1;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        open();
        setActive(event.key === 'ArrowDown' ? 0 : last);
      } else {
        setActive((current) =>
          event.key === 'ArrowDown' ? Math.min(last, current + 1) : Math.max(0, current - 1),
        );
      }
    } else if (event.key === 'Enter' && isOpen && active >= 0 && shown[active]) {
      event.preventDefault();
      pick(shown[active]);
    } else if (event.key === 'Escape' && isOpen) {
      // Close just the list, not the pop-up it sits in.
      event.preventDefault();
      event.stopPropagation();
      close();
    } else {
      if (event.key === 'Tab') close();
      onKeyDown?.(event);
    }
  };

  return (
    <div ref={wrapper} className={cn('relative', className)}>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-activedescendant={isOpen && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        autoFocus={autoFocus}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setActive(-1);
          if (!popup) open();
        }}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          'block min-h-11 w-full rounded-md border border-line-strong bg-surface bg-clip-padding pr-20 pl-3 text-base text-fg',
          'transition-colors duration-150 placeholder:text-muted hover:border-fg/60 focus:border-accent focus-visible:outline-offset-0 focus-visible:outline-accent',
          'aria-invalid:border-danger aria-invalid:focus-visible:outline-danger',
          isOpen && 'border-accent',
        )}
      />
      <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
        {value && (
          <button
            type="button"
            aria-label="Clear name"
            title="Clear"
            onClick={() => {
              onChange('');
              close();
            }}
            className="grid size-8 place-items-center rounded-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        )}
        {names.length > 0 && (
          <button
            type="button"
            // The input already handles the keyboard (arrow down opens the list).
            tabIndex={-1}
            aria-label={`Show ${listLabel.toLowerCase()}`}
            aria-expanded={isOpen}
            onClick={() => (popup ? close() : open())}
            className="grid size-8 place-items-center rounded-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <ChevronDown
              aria-hidden="true"
              className={cn('size-4 transition-transform duration-200', isOpen && 'rotate-180')}
            />
          </button>
        )}
      </div>

      {isOpen &&
        createPortal(
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-label={listLabel}
            style={{ ...popup.style, maxHeight: LIST_MAX_HEIGHT }}
            className={cn(
              'fixed z-[60] scrollbar-soft overflow-y-auto rounded-card border border-white/70 glass-float p-1.5 text-fg shadow-raised motion-safe:animate-search-in',
              popup.style.bottom !== undefined ? 'origin-bottom' : 'origin-top',
            )}
          >
            <li
              role="presentation"
              className="px-3 pt-1 pb-1.5 text-xs font-semibold tracking-label text-muted uppercase"
            >
              {listLabel}
            </li>
            {shown.map((name, index) => {
              const selected = name.toLowerCase() === typed;
              return (
                <li
                  key={name}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={selected}
                  // Keep focus in the input, so typing can carry on after a click.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(name)}
                  className={cn(
                    'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-3 text-sm transition-colors',
                    index === active ? 'bg-accent-soft text-accent' : 'text-fg',
                    selected && 'font-semibold',
                  )}
                >
                  <Initials name={name} />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <Check
                    aria-hidden="true"
                    className={cn('size-4 shrink-0', selected ? 'text-accent' : 'invisible')}
                  />
                </li>
              );
            })}
          </ul>,
          popup.container,
        )}
    </div>
  );
}
