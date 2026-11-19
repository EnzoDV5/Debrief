import type { ActionItem, Decision, Meeting, TranscriptLine } from '@debrief/shared';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ActionItemDialog } from '@/features/actionItems/ActionItemDialog';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/format';
import { MeetingActionCard } from './MeetingActionCard';
import { DecisionBubble } from './DecisionBubble';
import { NewDecisionDialog } from './NewDecisionDialog';
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
 * Actions and decisions share a document row with their source line, so both sides scroll together.
 */
export function MeetingDocument({ meeting }: { meeting: Meeting }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingDecision, setAddingDecision] = useState(false);
  const { hash } = useLocation();
  const targetLine = lineFromHash(hash);

  const { byLine, unlinkedItems, unlinkedDecisions } = useMemo(() => {
    const lineNumbers = new Set(meeting.transcriptLines.map((l) => l.n));
    const map = new Map<number, Annotations>();
    const looseItems: ActionItem[] = [];
    const looseDecisions: Decision[] = [];
    const bucket = (n: number) => {
      if (!map.has(n)) map.set(n, { items: [], decisions: [] });
      return map.get(n)!;
    };
    for (const item of meeting.actionItems) {
      if (item.sourceLine !== null && lineNumbers.has(item.sourceLine))
        bucket(item.sourceLine).items.push(item);
      else looseItems.push(item);
    }
    for (const decision of meeting.decisions) {
      if (decision.sourceLine !== null && lineNumbers.has(decision.sourceLine))
        bucket(decision.sourceLine).decisions.push(decision);
      else looseDecisions.push(decision);
    }
    return { byLine: map, unlinkedItems: looseItems, unlinkedDecisions: looseDecisions };
  }, [meeting.transcriptLines, meeting.actionItems, meeting.decisions]);

  const ownerSuggestions = useMemo(
    () =>
      [
        ...new Set(
          [
            ...meeting.transcriptLines.map((line) => line.speaker),
            ...meeting.actionItems.map((item) => item.owner),
          ].filter((name): name is string => Boolean(name)),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [meeting.transcriptLines, meeting.actionItems],
  );
  const done = meeting.actionItems.filter((item) => item.status === 'done').length;
  const needsReview = meeting.actionItems.filter((item) => item.needsReview).length;

  // Bring a linked line into view once it exists (after a reload or from a shared link).
  useEffect(() => {
    if (targetLine !== null) {
      document.getElementById(`L${targetLine}`)?.scrollIntoView?.({ block: 'center' });
    }
  }, [targetLine, meeting.transcriptLines]);

  return (
    <section aria-labelledby="transcript-title" className="min-w-0">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_27rem]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <h2 id="transcript-title" className="text-lg font-bold">
            Transcript
          </h2>
          <Legend />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div>
            <h3 className="text-lg font-bold">Actions & decisions</h3>
            <ul aria-label="Counts" className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
              <li>{plural(meeting.actionItems.length, 'action item')}</li>
              <li>{plural(meeting.decisions.length, 'decision')}</li>
              {meeting.actionItems.length > 0 && <li>{done} done</li>}
              {needsReview > 0 && <li className="text-warning">{needsReview} needs review</li>}
            </ul>
            <p className="mt-1.5 text-xs text-muted">
              Decisions record agreements. Action items are tasks to complete.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus aria-hidden="true" className="size-4" />}
              onClick={() => setAdding(true)}
            >
              Add action item
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus aria-hidden="true" className="size-4" />}
              onClick={() => setAddingDecision(true)}
            >
              Add decision
            </Button>
          </div>
          {meeting.actionItems.length === 0 && meeting.decisions.length === 0 && (
            <p className="w-full text-sm text-muted">
              No actions or decisions yet. Add one, or wait for the analysis to finish.
            </p>
          )}
        </div>
      </div>
      <ol className="pt-5">
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
                'grid scroll-mt-24 items-start gap-x-5 gap-y-3 rounded-md py-2.5 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_27rem]',
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
                  <p className="text-lg leading-8 wrap-break-word text-fg/90 sm:text-xl sm:leading-9">
                    <LineText
                      text={line.text}
                      marks={marksFor(line, notes)}
                      activeId={activeId}
                      onActive={setActiveId}
                    />
                  </p>
                </div>
              </div>
              {notes && (notes.items.length > 0 || notes.decisions.length > 0) && (
                <div className="space-y-3 pl-12 sm:pl-14 xl:pl-0">
                  {notes.decisions.map((decision) => (
                    <DecisionBubble
                      key={decision.id}
                      meetingId={meeting.id}
                      decision={decision}
                      active={activeId === decision.id}
                      onActiveChange={(active) => setActiveId(active ? decision.id : null)}
                    />
                  ))}
                  {notes.items.map((item) => (
                    <MeetingActionCard
                      key={item.id}
                      meeting={meeting}
                      item={item}
                      ownerSuggestions={ownerSuggestions}
                      active={activeId === item.id}
                      onActiveChange={(active) => setActiveId(active ? item.id : null)}
                    />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {(unlinkedItems.length > 0 || unlinkedDecisions.length > 0) && (
        <section
          aria-label="Notes without a transcript line"
          className="mt-8 grid gap-4 border-t border-line pt-6 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_27rem]"
        >
          <div>
            <h3 className="font-semibold">Other notes</h3>
            <p className="mt-1 text-sm text-muted">
              These actions and decisions have no verified transcript line.
            </p>
          </div>
          <div className="space-y-3">
            {unlinkedDecisions.map((decision) => (
              <DecisionBubble key={decision.id} meetingId={meeting.id} decision={decision} />
            ))}
            {unlinkedItems.map((item) => (
              <MeetingActionCard
                key={item.id}
                meeting={meeting}
                item={item}
                ownerSuggestions={ownerSuggestions}
                active={activeId === item.id}
                onActiveChange={(active) => setActiveId(active ? item.id : null)}
              />
            ))}
          </div>
        </section>
      )}

      <ActionItemDialog
        open={adding}
        onClose={() => setAdding(false)}
        meetingId={meeting.id}
        ownerSuggestions={ownerSuggestions}
      />
      {addingDecision && (
        <NewDecisionDialog meetingId={meeting.id} onClose={() => setAddingDecision(false)} />
      )}
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
              'rounded-mark px-0.5 text-fg transition-shadow',
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
