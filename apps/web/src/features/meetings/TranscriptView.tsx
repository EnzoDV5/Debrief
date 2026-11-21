// The transcript with numbered, linkable lines.
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
  className,
}: {
  lines: TranscriptLine[];
  linkable?: boolean;
  className?: string;
}) {
  const { hash } = useLocation();
  const targetLine = linkable ? lineFromHash(hash) : null;

  useEffect(() => {
    if (targetLine === null) return;
    document.getElementById(`L${targetLine}`)?.scrollIntoView?.({ block: 'center' });
  }, [targetLine, lines]);

  return (
    <ol className={cn('text-sm', className)}>
      {lines.map((line, i) => {
        const newSpeaker = line.speaker && line.speaker !== lines[i - 1]?.speaker;
        const isTarget = line.n === targetLine;
        return (
          <li
            key={line.n}
            id={linkable ? `L${line.n}` : undefined}
            aria-current={isTarget ? 'location' : undefined}
            className={cn(
              'grid scroll-mt-24 grid-cols-[2.75rem_minmax(0,1fr)] gap-x-2 rounded-sm py-1 pr-2 transition-colors [contain-intrinsic-size:auto_2rem] [content-visibility:auto]',
              isTarget && 'bg-accent-soft ring-1 ring-accent/30',
              newSpeaker && i > 0 && 'mt-3',
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
              {newSpeaker && <p className="font-semibold text-fg">{line.speaker}</p>}
              <p className="wrap-break-word text-fg/90">{line.text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
