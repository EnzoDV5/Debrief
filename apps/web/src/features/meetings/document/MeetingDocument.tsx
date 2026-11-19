import type { ActionItem, Decision, Meeting, TranscriptLine } from '@debrief/shared';
import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router';
import { cn } from '@/lib/cn';
import { findPhrase, segment, type Mark } from './highlight';

type Annotations = { items: ActionItem[]; decisions: Decision[] };

/** "#L12" → 12, so a shared link (or a click on a line number) highlights and scrolls to it. */
function lineFromHash(hash: string): number | null {
  const match = /^#L(\d+)$/.exec(hash);
  return match ? Number(match[1]) : null;
}

/** The quote's words on its line. Models sometimes start the quote with "Name:", so retry without. */
function findQuote(line: TranscriptLine, quote: string | null) {
  if (!quote) return null;
  return (
    findPhrase(line.text, quote) ?? findPhrase(line.text, quote.replace(/^[^:]{1,40}:\s*/, ''))
  );
}

/** Highlights for one line: each item's quote, its date words, and decisions made on that line. */
function marksFor(line: TranscriptLine, notes: Annotations | undefined): Mark[] {
  if (!notes) return [];
  const marks: Mark[] = [];
  for (const item of notes.items) {
    const quote = findQuote(line, item.sourceQuote);
    if (quote) marks.push({ ...quote, kind: 'action', itemId: item.id });
    const date = item.dueDateText ? findPhrase(line.text, item.dueDateText) : null;
    if (date) marks.push({ ...date, kind: 'date', itemId: item.id });
  }
  for (const decision of notes.decisions) {
    // Decisions are stored with their line, not a quote, so the whole line is the anchor.
    marks.push({ start: 0, end: line.text.length, kind: 'decision', itemId: decision.id });
  }
  return marks;
}

/**
 * The original transcript stays on the page background. Source words are highlighted and linked
 * to the action cards in the right rail.
 */
export function MeetingDocument({
  meeting,
  activeId,
  onActiveChange,
}: {
  meeting: Meeting;
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
}) {
  const { hash } = useLocation();
  const targetLine = lineFromHash(hash);

  const byLine = useMemo(() => {
    const lineNumbers = new Set(meeting.transcriptLines.map((l) => l.n));
    const map = new Map<number, Annotations>();
    const bucket = (n: number) => {
      if (!map.has(n)) map.set(n, { items: [], decisions: [] });
      return map.get(n)!;
    };
    for (const item of meeting.actionItems) {
      if (item.sourceLine !== null && lineNumbers.has(item.sourceLine))
        bucket(item.sourceLine).items.push(item);
    }
    for (const decision of meeting.decisions) {
      if (decision.sourceLine !== null && lineNumbers.has(decision.sourceLine))
        bucket(decision.sourceLine).decisions.push(decision);
    }
    return map;
  }, [meeting.transcriptLines, meeting.actionItems, meeting.decisions]);

  // Bring a linked line into view once it exists (after a reload or from a shared link).
  useEffect(() => {
    if (targetLine !== null) {
      document.getElementById(`L${targetLine}`)?.scrollIntoView?.({ block: 'center' });
    }
  }, [targetLine, meeting.transcriptLines]);

  return (
    <section aria-labelledby="transcript-title" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <h2 id="transcript-title" className="text-lg font-bold">
          Transcript
        </h2>
        <Legend />
      </div>
      <ol className="py-5">
        {meeting.transcriptLines.map((line, i) => {
          const notes = byLine.get(line.n);
          const newSpeaker =
            line.speaker && line.speaker !== meeting.transcriptLines[i - 1]?.speaker;
          return (
            <li
              key={line.n}
              id={`L${line.n}`}
              aria-current={line.n === targetLine ? 'location' : undefined}
              className={cn(
                'scroll-mt-24 rounded-md py-2.5 pr-2',
                line.n === targetLine && 'bg-accent-soft/60',
                newSpeaker && i > 0 && 'mt-5',
                // Off-screen plain lines skip rendering (smooth on 1 MB transcripts).
                !notes && '[contain-intrinsic-size:auto_3rem] [content-visibility:auto]',
              )}
            >
              <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[2.75rem_minmax(0,1fr)]">
                <a
                  href={`#L${line.n}`}
                  aria-label={`Line ${line.n}`}
                  className="pt-0.5 text-right font-mono text-xs text-muted tabular-nums hover:text-accent"
                >
                  {line.n}
                </a>
                <div className="min-w-0">
                  {newSpeaker && <p className="mb-1 text-base font-bold">{line.speaker}</p>}
                  <p className="wrap-break-word text-lg leading-8 text-fg/90 sm:text-xl sm:leading-9">
                    <LineText
                      text={line.text}
                      marks={marksFor(line, notes)}
                      activeId={activeId}
                      onActive={onActiveChange}
                    />
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const MARK_STYLES: Record<Mark['kind'], string> = {
  decision: 'bg-success-soft',
  action: 'bg-accent-soft',
  date: 'bg-spark/70 font-semibold',
};

/** A line's text with its highlights. The strongest kind wins where marks overlap (date > action > decision). */
function LineText({
  text,
  marks,
  activeId,
  onActive,
}: {
  text: string;
  marks: Mark[];
  activeId: string | null;
  onActive: (id: string | null) => void;
}) {
  if (marks.length === 0) return <>{text}</>;
  return (
    <>
      {segment(text, marks).map((piece, i) => {
        if (piece.marks.length === 0) return <span key={i}>{piece.text}</span>;
        const kind = piece.marks.some((m) => m.kind === 'date')
          ? 'date'
          : piece.marks.some((m) => m.kind === 'action')
            ? 'action'
            : 'decision';
        const owner = piece.marks.find((m) => m.kind === kind) ?? piece.marks[0]!;
        const active = piece.marks.some((m) => m.itemId === activeId);
        return (
          <mark
            key={i}
            data-kind={kind}
            onMouseEnter={() => onActive(owner.itemId)}
            onMouseLeave={() => onActive(null)}
            className={cn(
              'rounded-[3px] px-0.5 text-fg transition-shadow',
              MARK_STYLES[kind],
              active && 'ring-2 ring-accent/50',
            )}
          >
            {piece.text}
          </mark>
        );
      })}
    </>
  );
}

function Legend() {
  return (
    <ul
      aria-label="Highlight colours"
      className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"
    >
      <li className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="size-3 rounded-sm bg-accent-soft ring-1 ring-accent/30"
        />
        Action item
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="size-3 rounded-sm bg-spark/70 ring-1 ring-fg/20" />
        Date
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="size-3 rounded-sm bg-success-soft ring-1 ring-success/30"
        />
        Decision
      </li>
    </ul>
  );
}
