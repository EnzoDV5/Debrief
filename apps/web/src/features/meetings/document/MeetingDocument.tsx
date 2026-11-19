import type { ActionItem, Decision, Meeting, TranscriptLine } from '@debrief/shared';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { Card } from '@/components/ui/Card';
import { ActionItemCard } from '@/features/actionItems/ActionItemCard';
import { ActionItemDialog } from '@/features/actionItems/ActionItemDialog';
import { DeleteActionItemDialog } from '@/features/actionItems/DeleteActionItemDialog';
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
 * The meeting as an annotated document, like comments in Google Docs: the transcript on the left,
 * action items as bubbles in the right margin next to the line they came from,
 * with their quoted words highlighted (and date words in a second colour). Hovering a bubble lights
 * up its words, and hovering highlighted words lights up its bubble.
 *
 * Layout: every line and its bubbles share one CSS grid row, so bubbles line up with their text
 * without measuring positions. On narrow screens the grid becomes one column and bubbles sit
 * directly under their line.
 */
export function MeetingDocument({ meeting }: { meeting: Meeting }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ActionItem | null>(null);
  const [deleting, setDeleting] = useState<ActionItem | null>(null);
  const { hash } = useLocation();
  const targetLine = lineFromHash(hash);

  const { byLine, unlinked } = useMemo(() => {
    const lineNumbers = new Set(meeting.transcriptLines.map((l) => l.n));
    const map = new Map<number, Annotations>();
    const loose: Annotations = { items: [], decisions: [] };
    const bucket = (n: number | null) => {
      if (n === null || !lineNumbers.has(n)) return loose;
      if (!map.has(n)) map.set(n, { items: [], decisions: [] });
      return map.get(n)!;
    };
    for (const item of meeting.actionItems) bucket(item.sourceLine).items.push(item);
    for (const decision of meeting.decisions) bucket(decision.sourceLine).decisions.push(decision);
    return { byLine: map, unlinked: loose };
  }, [meeting.transcriptLines, meeting.actionItems, meeting.decisions]);

  const ownerSuggestions = useMemo(
    () =>
      [
        ...new Set(
          [
            ...meeting.transcriptLines.map((l) => l.speaker),
            ...meeting.actionItems.map((i) => i.owner),
          ].filter((name): name is string => Boolean(name)),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [meeting.transcriptLines, meeting.actionItems],
  );

  // Bring a linked line into view once it exists (after a reload or from a shared link).
  useEffect(() => {
    if (targetLine !== null) {
      document.getElementById(`L${targetLine}`)?.scrollIntoView?.({ block: 'center' });
    }
  }, [targetLine, meeting.transcriptLines]);

  const bubbles = (notes: Annotations) => (
    <>
      {notes.items.map((item) => (
        <ActionItemCard
          key={item.id}
          item={item}
          bubble
          active={activeId === item.id}
          onActiveChange={(on) => setActiveId(on ? item.id : null)}
          onEdit={() => setEditing(item)}
          onDelete={() => setDeleting(item)}
          source={
            item.sourceLine === null && item.origin === 'manual' ? (
              <p className="text-muted">Added by you</p>
            ) : null
          }
        />
      ))}
    </>
  );

  const hasUnlinked = unlinked.items.length > 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <h2 className="font-bold">Transcript</h2>
        <Legend />
      </div>

      {hasUnlinked && (
        <section
          aria-label="Not linked to a transcript line"
          className="grid gap-x-6 gap-y-3 border-b border-line bg-surface-2/60 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
        >
          <p className="text-sm text-muted">
            <span className="font-semibold text-fg">Not linked to a line.</span> Added by you, or
            the AI’s quote couldn’t be matched to the transcript.
          </p>
          <div className="space-y-3">{bubbles(unlinked)}</div>
        </section>
      )}

      <ol className="px-2 py-4 sm:px-4">
        {meeting.transcriptLines.map((line, i) => {
          const notes = byLine.get(line.n);
          const hasNotes = Boolean(notes?.items.length);
          const newSpeaker =
            line.speaker && line.speaker !== meeting.transcriptLines[i - 1]?.speaker;
          return (
            <li
              key={line.n}
              id={`L${line.n}`}
              aria-current={line.n === targetLine ? 'location' : undefined}
              className={cn(
                'grid scroll-mt-24 gap-x-6 gap-y-2 rounded-sm px-2 py-1.5 lg:grid-cols-[minmax(0,1fr)_20rem]',
                line.n === targetLine && 'bg-accent-soft/60',
                newSpeaker && i > 0 && 'mt-3',
                // Off-screen plain lines skip rendering (smooth on 1 MB transcripts).
                !hasNotes && '[contain-intrinsic-size:auto_2rem] [content-visibility:auto]',
              )}
            >
              <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2">
                <a
                  href={`#L${line.n}`}
                  aria-label={`Line ${line.n}`}
                  className="pt-0.5 text-right font-mono text-xs text-muted tabular-nums hover:text-accent"
                >
                  {line.n}
                </a>
                <div className="min-w-0">
                  {newSpeaker && <p className="text-sm font-semibold">{line.speaker}</p>}
                  <p className="wrap-break-word text-[0.9375rem] leading-relaxed text-fg/90">
                    <LineText
                      text={line.text}
                      marks={marksFor(line, notes)}
                      activeId={activeId}
                      onActive={setActiveId}
                    />
                  </p>
                </div>
              </div>
              {hasNotes && notes && (
                <div className="space-y-3 pb-2 pl-11 lg:pl-0">{bubbles(notes)}</div>
              )}
            </li>
          );
        })}
      </ol>

      {editing && (
        <ActionItemDialog
          open
          onClose={() => setEditing(null)}
          meetingId={meeting.id}
          item={editing}
          ownerSuggestions={ownerSuggestions}
        />
      )}
      <DeleteActionItemDialog item={deleting} onClose={() => setDeleting(null)} />
    </Card>
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
