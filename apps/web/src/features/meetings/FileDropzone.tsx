import { FileText, Upload, X } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import type { FieldControlProps } from '@/components/ui/Field';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/format';

/**
 * Drag a file in, or click/press Enter to browse. It's a real <input type="file"> inside a
 * <label>, so keyboard and screen-reader users get the native file picker. Dragging is a bonus
 * on top, not the only way in.
 */
export function FileDropzone({
  control,
  file,
  summary,
  onFile,
  onClear,
}: {
  control: FieldControlProps;
  file: File | null;
  /** e.g. "15 lines · 3 speakers", shown once the file has been read. */
  summary?: string;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-line-strong bg-surface p-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
          <FileText aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{file.name}</p>
          <p className="text-xs text-muted">
            {formatBytes(file.size)}
            {summary && ` · ${summary}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label={`Remove ${file.name}`}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-surface-2 hover:text-fg"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault(); // required, or the browser opens the file instead
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        'flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
        dragging
          ? 'border-accent bg-accent-soft'
          : control['aria-invalid']
            ? 'border-danger bg-danger-soft/40'
            : 'border-line-strong/60 bg-surface-2 hover:border-accent',
      )}
    >
      <Upload aria-hidden="true" className="size-6 text-accent" />
      <span className="font-semibold">
        Drag a transcript here, or <span className="text-accent underline">browse files</span>
      </span>
      <span className="text-sm text-muted">.txt, .vtt or .md · up to 1 MB</span>
      <input
        {...control}
        type="file"
        accept=".txt,.vtt,.md,text/plain,text/vtt,text/markdown"
        className="sr-only"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (chosen) onFile(chosen);
          event.target.value = ''; // so choosing the same file again still fires onChange
        }}
      />
    </label>
  );
}
