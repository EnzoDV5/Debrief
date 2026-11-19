import type { TranscriptLine } from '@debrief/shared';
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { cn } from '@/lib/cn';

/** "#L12" → 12. Anything else → null. */
function lineFromHash(hash: string): number | null {
  const match = /^#L(\d+)$/.exec(hash);
  return match ? Number(match[1]) : null;
}

/**
 * Numbered transcript. Each line has an id ("L12") and its number is a link to it, so a line can
 * be shared or, from Phase 3, jumped to from an action item.
 *
 * The highlighted line comes from the URL (#L12) through React, not the CSS :target selector:
 * browsers decide :target when the page first loads, but our transcript arrives a moment later
 * from the api, so a shared link would otherwise land on nothing.
 *
 * The speaker name is only repeated when the speaker changes, like a chat log.
 * `content-visibility: auto` lets the browser skip rendering off-screen lines, which keeps a
 * 1 MB transcript (thousands of lines) smooth to scroll.
 */
export function TranscriptView({
  lines,
  linkable = true,
  className,
}: {
  lines: TranscriptLine[];
  /** Off for previews, where the lines aren't on the page yet. */
  linkable?: boolean;
  className?: string;
}) {
  const { hash } = useLocation();
  const targetLine = linkable ? lineFromHash(hash) : null;

  // Bring the linked line into view once it exists (also after a reload or a shared link).
  useEffect(() => {
    if (targetLine === null) return;
    document.getElementById(`L${targetLine}`)?.scrollIntoView({ block: 'center' });
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
              <a
                href={`#L${line.n}`}
                aria-label={`Line ${line.n}`}
                className="pt-0.5 text-right font-mono text-xs text-muted tabular-nums hover:text-accent"
              >
                {line.n}
              </a>
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
