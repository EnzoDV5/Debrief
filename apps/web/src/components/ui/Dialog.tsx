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
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
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
    if (visible && !dialog.open) {
      dialog.showModal();
      // Start on the first field (or Cancel in a confirm dialog), not on the close button.
      dialog
        .querySelector<HTMLElement>(
          '[data-dialog-body] :is(input, textarea, select, button):not([disabled])',
        )
        ?.focus();
    }
    if (!visible && dialog.open) dialog.close();
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
        'm-auto w-[min(100%-2rem,30rem)] overflow-visible rounded-panel border border-white/70 glass-float p-0 text-fg shadow-raised',
        'backdrop:bg-sidebar/50 backdrop:backdrop-blur-sm',
        closing
          ? 'pointer-events-none animate-dialog-out backdrop:animate-fade-out'
          : 'open:motion-safe:animate-dialog-in open:backdrop:motion-safe:animate-fade-in',
      )}
    >
      <div className="p-6 sm:p-7">
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
          {children}
        </div>
      </div>
    </dialog>
  );
}
