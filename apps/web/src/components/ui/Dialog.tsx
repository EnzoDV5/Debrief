// A modal on the native <dialog>: focus trap, Esc to close and focus return come for free.
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

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
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[min(100%-2rem,28rem)] rounded-card border border-white/70 glass-float p-0 text-fg shadow-raised"
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
