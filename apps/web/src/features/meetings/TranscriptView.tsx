// The transcript with numbered, linkable lines. 'compact' is small text for boxes; 'document'
// matches the meeting page (large text, bold speakers, roomy lines) for a full-frame view.
import type { TranscriptLine } from '@debrief/shared';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { cn } from '@/lib/cn';

function lineFromHash(hash: string): number | null {
  const match = /^#L(\d+)$/.exec(hash);
  return match ? Number(match[1]) : null;
}

export function TranscriptView({
  lines,
  linkable = true,
  variant = 'compact',
  className,
}: {
  lines: TranscriptLine[];
  linkable?: boolean;
  variant?: 'compact' | 'document';
  className?: string;
}) {
  const doc = variant === 'document';
  const { hash } = useLocation();
  const targetLine = linkable ? lineFromHash(hash) : null;

  useEffect(() => {
    if (targetLine === null) return;
    document.getElementById(`L${targetLine}`)?.scrollIntoView?.({ block: 'center' });
  }, [targetLine, lines]);

  return (
    <ol className={cn(doc ? 'pt-3' : 'text-sm', className)}>
      {lines.map((line, i) => {
        const newSpeaker = line.speaker && line.speaker !== lines[i - 1]?.speaker;
        const isTarget = line.n === targetLine;
        return (
          <li
            key={line.n}
            id={linkable ? `L${line.n}` : undefined}
            aria-current={isTarget ? 'location' : undefined}
            className={cn(
              'grid scroll-mt-24 rounded-sm transition-colors [content-visibility:auto]',
              doc
                ? 'grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 px-4 py-2.5 [contain-intrinsic-size:auto_3rem] sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:px-8'
                : 'grid-cols-[2.75rem_minmax(0,1fr)] gap-x-2 py-1 pr-2 [contain-intrinsic-size:auto_2rem]',
              isTarget && 'bg-accent-soft ring-1 ring-accent/30',
              newSpeaker && i > 0 && (doc ? 'pt-7' : 'mt-3'),
            )}
          >
            {linkable ? (
              <Link
                to={`#L${line.n}`}
                aria-label={`Line ${line.n}`}
                className="pt-0.5 text-right font-mono text-xs text-muted tabular-nums hover:text-accent"
              >
                {line.n}
              </Link>
            ) : (
              <span
                aria-hidden="true"
                className="pt-0.5 text-right font-mono text-xs text-muted tabular-nums"
              >
                {line.n}
              </span>
            )}
            <div className="min-w-0">
              {newSpeaker && (
                <p className={cn('text-fg', doc ? 'mb-1 text-base font-bold' : 'font-semibold')}>
                  {line.speaker}
                </p>
              )}
              <p
                className={cn(
                  'wrap-break-word text-fg/90',
                  doc && 'text-lg leading-8 sm:text-xl sm:leading-9',
                )}
              >
                {line.text}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
