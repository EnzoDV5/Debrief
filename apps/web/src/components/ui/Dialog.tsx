import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Modal built on the native <dialog> element, which gives us for free: focus moved inside,
 * focus trapped while open, Esc to close, focus returned to the trigger, and the rest of the
 * page made inert for screen readers.
 */
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

  // Keep the element in sync with the `open` prop.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Fires on Esc and on dialog.close(): tell the parent so its state matches.
      onClose={onClose}
      // A click on the backdrop lands on the <dialog> itself (the content is a child).
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[min(100%-2rem,28rem)] rounded-card bg-surface p-0 text-fg shadow-raised"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-bold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-surface-2 hover:text-fg"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        {description && (
          <div id={descriptionId} className="mt-2 text-sm text-muted">
            {description}
          </div>
        )}
        <div className="mt-5">{children}</div>
      </div>
    </dialog>
  );
}
