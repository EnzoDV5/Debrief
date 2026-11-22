// Every pop-up in the app: built on the native <dialog> (focus trap, Esc and focus return come for
// free), with a blurred backdrop, a glass panel, and a smooth animation in and out.
import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const CLOSE_MS = 200;

export function Dialog({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  // 'lg': a wider, squarer pop-up for forms laid out in two columns, so they don't get too tall.
  size?: 'md' | 'lg';
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // "visible" stays true for a moment after open turns false, so the exit animation can play.
  const [visible, setVisible] = useState(open);
  if (open && !visible) setVisible(true);
  const closing = visible && !open;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!visible && dialog.open) dialog.close();
    if (!visible || dialog.open) return;

    dialog.showModal();
    // Hold focus on the pop-up itself while it moves in.
    dialog.focus();
    const held = document.activeElement;
    // Start on the first field (or Cancel in a confirm dialog), not on the close button. Only once
    // the pop-up has finished sliding and scaling in: Chrome draws the text cursor where the field
    // was at the moment it got focus, so focusing mid-animation left the cursor outside the box.
    const body = dialog.querySelector<HTMLElement>('[data-dialog-body]');
    const focusFirstField = () => {
      cleanup();
      // The user may already have clicked or tabbed somewhere; don't pull focus back.
      if (!dialog.open || document.activeElement !== held) return;
      dialog
        .querySelector<HTMLElement>(
          '[data-dialog-body] :is(input, textarea, select, button):not([disabled])',
        )
        ?.focus();
    };
    const onEnd = (event: AnimationEvent) => {
      if (event.target === body) focusFirstField();
    };
    const timer = window.setTimeout(focusFirstField, 600); // In case animationend never comes.
    const cleanup = () => {
      window.clearTimeout(timer);
      body?.removeEventListener('animationend', onEnd);
    };
    // No entrance animation (reduced motion, or tests without CSS): focus straight away.
    const animation = body ? getComputedStyle(body).animationName : '';
    if (body && animation && animation !== 'none') body.addEventListener('animationend', onEnd);
    else focusFirstField();
    return cleanup;
  }, [visible]);

  useEffect(() => {
    if (!closing) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setVisible(false), reduce ? 0 : CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [closing]);

  return (
    <dialog
      ref={ref}
      // Focusable, so it can hold focus while it animates in (see above). No ring for that.
      tabIndex={-1}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        // Esc: let the parent close it, so it animates out like every other way of closing.
        event.preventDefault();
        if (open) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && open) onClose();
      }}
      className={cn(
        'm-auto outline-none',
        size === 'lg' ? 'w-[min(100%-2rem,46rem)]' : 'w-[min(100%-2rem,30rem)]',
        'overflow-visible rounded-panel border border-white/70 glass-float p-0 text-fg shadow-raised',
        'backdrop:bg-sidebar/50 backdrop:backdrop-blur-sm',
        closing
          ? 'pointer-events-none animate-dialog-out backdrop:animate-fade-out'
          : 'open:motion-safe:animate-dialog-in open:backdrop:motion-safe:animate-fade-in',
      )}
    >
      {/* Scrolls when taller than the screen (long forms on phones). The scrolling box is inside
          the dialog, so dropdown lists, which attach to the dialog itself, are never clipped. */}
      <div className="scrollbar-soft max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl leading-tight font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1.5 -mr-2 grid size-9 shrink-0 place-items-center rounded-pill text-muted transition-colors hover:bg-fg/5 hover:text-fg"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        {description && (
          <div id={descriptionId} className="mt-2 text-sm text-muted">
            {description}
          </div>
        )}
        <div data-dialog-body="" className="mt-5 motion-safe:animate-dialog-body">
          {/* Only while shown: a closed dialog shouldn't leave a hidden copy of its text and form
              in the page (every card has one), and forms start fresh each time they open. */}
          {visible && children}
        </div>
      </div>
    </dialog>
  );
}
