import type { TranscriptLine } from '@debrief/shared';
import { Eye } from 'lucide-react';
import { plural } from '@/lib/format';
import { TranscriptView } from './TranscriptView';

const PREVIEW_LINES = 8;

export function transcriptSummary(lines: TranscriptLine[]): string {
  const speakers = new Set(lines.map((l) => l.speaker).filter(Boolean)).size;
  return [plural(lines.length, 'line'), speakers > 0 && plural(speakers, 'speaker')]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Shows how Debrief will read the transcript (numbered lines, detected speakers) before it's
 * saved, so surprises are caught here and not after analysis.
 */
export function TranscriptPreview({ lines }: { lines: TranscriptLine[] }) {
  if (lines.length === 0) {
    return (
      <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-md bg-surface-2 px-6 py-10 text-center text-sm text-muted">
        <Eye aria-hidden="true" className="mb-2 size-5" />A preview of the numbered lines appears
        here.
      </div>
    );
  }

  const hidden = lines.length - PREVIEW_LINES;
  return (
    <section aria-label="Transcript preview" className="rounded-md bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="eyebrow text-muted">Preview</h3>
        <p role="status" className="text-xs font-semibold text-fg">
          {transcriptSummary(lines)}
        </p>
      </div>
      <TranscriptView lines={lines.slice(0, PREVIEW_LINES)} linkable={false} />
      {hidden > 0 && (
        <p className="mt-3 pl-[3.25rem] text-xs text-muted">+ {plural(hidden, 'more line')}</p>
      )}
    </section>
  );
}
