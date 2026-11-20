import type { ActionItem, Decision, Meeting, TranscriptLine } from '@debrief/shared';
import { Plus, TextSelect } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ActionItemDialog } from '@/features/actionItems/ActionItemDialog';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/format';
import { MeetingActionCard } from './MeetingActionCard';
import { DecisionBubble } from './DecisionBubble';
import { NewDecisionDialog } from './NewDecisionDialog';
import { findPhrase, segment, type Mark } from './highlight';
import {
  PickToolbar,
  pickWholeLine,
  useTranscriptSelection,
  type PickKind,
  type PickToolbarState,
  type TranscriptPick,
} from './transcriptPick';
import type { FindMatch, TranscriptFind } from './useTranscriptFind';

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

/** Find in transcript's id for a match, shared by its mark and the "current match" check. */
const findId = (index: number) => `find-${index}`;

/**
 * Highlights for one line: each item's quote, its date words, decisions made on that line, and
 * any Find in transcript matches.
 */
function marksFor(
  line: TranscriptLine,
  notes: Annotations | undefined,
  found: Array<FindMatch & { index: number }> = [],
): Mark[] {
  const marks: Mark[] = found.map((match) => ({
    start: match.start,
    end: match.end,
    kind: 'find',
    itemId: findId(match.index),
  }));
  if (!notes) return marks;
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
export function MeetingDocument({ meeting, find }: { meeting: Meeting; find?: TranscriptFind }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingDecision, setAddingDecision] = useState(false);
  const { hash } = useLocation();
  const targetLine = lineFromHash(hash);

  // Select text (or use a line's + button) → toolbar → a pre-filled action item or decision.
  const transcriptRef = useRef<HTMLOListElement>(null);
  const [toolbar, setToolbar] = useState<PickToolbarState | null>(null);
  const [creating, setCreating] = useState<{ kind: PickKind; pick: TranscriptPick } | null>(null);
  useTranscriptSelection(transcriptRef, setToolbar);
  const closeToolbar = useCallback(() => setToolbar(null), []);
  const choose = (kind: PickKind) => {
    if (!toolbar) return;
    setCreating({ kind, pick: toolbar.pick });
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
  };

  // Find in transcript: matches grouped by line, numbered in reading order.
  const foundByLine = useMemo(() => {
    const map = new Map<number, Array<FindMatch & { index: number }>>();
    find?.matches.forEach((match, index) => {
      map.set(match.line, [...(map.get(match.line) ?? []), { ...match, index }]);
    });
    return map;
  }, [find?.matches]);
  const currentFindId = find?.matches.length ? findId(find.current) : null;

  // Bring the current match into view as the user steps through them.
  useEffect(() => {
    if (currentFindId) {
      document
        .querySelector(`[data-find-id="${currentFindId}"]`)
        ?.scrollIntoView?.({ block: 'center' });
    }
  }, [currentFindId, find?.query]);

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
          <p className="inline-flex items-center gap-1.5 text-sm text-muted">
            <TextSelect aria-hidden="true" className="size-4" />
            Select words to make an action item or decision
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <div>
            <h3 className="text-lg font-bold">Actions & decisions</h3>
            <ul aria-label="Counts" className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted">
              <li>{plural(meeting.actionItems.length, 'action item')}</li>
              <li>{plural(meeting.decisions.length, 'decision')}</li>
              {meeting.actionItems.length > 0 && <li>{done} done</li>}
              {needsReview > 0 && <li className="text-warning">{needsReview} needs review</li>}
            </ul>
            <p className="mt-1.5 text-sm text-muted">
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
      <ol ref={transcriptRef} className="pt-5">
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
                'group grid scroll-mt-24 items-start gap-x-5 gap-y-3 rounded-md py-2.5 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_27rem]',
                line.n === targetLine && 'bg-accent-soft/60',
                newSpeaker && i > 0 && 'mt-5',
                // Off-screen plain lines skip rendering (smooth on 1 MB transcripts).
                !notes && '[contain-intrinsic-size:auto_3rem] [content-visibility:auto]',
              )}
            >
              <div className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[2.75rem_minmax(0,1fr)]">
                {/* Hover a line for a + (at the end of its text, like a Google Docs comment
                    button) that turns the whole line into an item. Inside the row on purpose:
                    content-visibility clips anything outside it. Mouse only (tabIndex -1): a
                    tab stop per line would bury the page; keyboard users have the Add buttons. */}
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Make an item from line ${line.n}`}
                  onClick={(event) => {
                    const box = event.currentTarget.getBoundingClientRect();
                    setToolbar({
                      pick: pickWholeLine(line),
                      x: box.right,
                      y: box.top + box.height / 2,
                      source: 'line',
                    });
                  }}
                  className="absolute top-1.5 right-0 hidden size-7 place-items-center rounded-pill text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent-soft hover:text-accent lg:grid"
                >
                  <Plus aria-hidden="true" className="size-4" />
                </button>
                <a
                  href={`#L${line.n}`}
                  aria-label={`Line ${line.n}`}
                  className="pt-0.5 text-right font-mono text-xs text-muted tabular-nums hover:text-accent"
                >
                  {line.n}
                </a>
                <div className="min-w-0 lg:pr-10">
                  {newSpeaker && <p className="mb-1 text-base font-bold">{line.speaker}</p>}
                  {/* data-line-text: what a selection reads (see transcriptPick.tsx). */}
                  <p
                    data-line-text={line.n}
                    className="text-lg leading-8 wrap-break-word text-fg/90 sm:text-xl sm:leading-9"
                  >
                    <LineText
                      text={line.text}
                      marks={marksFor(line, notes, foundByLine.get(line.n))}
                      activeId={activeId}
                      onActive={setActiveId}
                      currentFindId={currentFindId}
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

      {toolbar && <PickToolbar state={toolbar} onChoose={choose} onClose={closeToolbar} />}
      {creating?.kind === 'action' && (
        <ActionItemDialog
          open
          onClose={() => setCreating(null)}
          meetingId={meeting.id}
          ownerSuggestions={ownerSuggestions}
          initialText={creating.pick.text}
          source={{ line: creating.pick.line, quote: creating.pick.quote }}
        />
      )}
      {creating?.kind === 'decision' && (
        <NewDecisionDialog
          meetingId={meeting.id}
          onClose={() => setCreating(null)}
          initialText={creating.pick.text}
          sourceLine={creating.pick.line}
        />
      )}
    </section>
  );
}

const MARK_STYLES: Record<Mark['kind'], string> = {
  decision: 'bg-success-soft',
  action: 'bg-accent-soft',
  date: 'bg-spark/70 font-semibold',
  find: 'bg-warning-soft',
};

// Where marks overlap, the first kind here wins the colour.
const MARK_PRIORITY: Mark['kind'][] = ['find', 'date', 'action', 'decision'];

/** A line's text with its highlights (item quotes, dates, decisions, Find matches). */
function LineText({
  text,
  marks,
  activeId,
  onActive,
  currentFindId,
}: {
  text: string;
  marks: Mark[];
  activeId: string | null;
  onActive: (id: string | null) => void;
  currentFindId: string | null;
}) {
  if (marks.length === 0) return <>{text}</>;
  return (
    <>
      {segment(text, marks).map((piece, i) => {
        if (piece.marks.length === 0) return <span key={i}>{piece.text}</span>;
        const kind = MARK_PRIORITY.find((k) => piece.marks.some((m) => m.kind === k))!;
        const owner = piece.marks.find((m) => m.kind === kind) ?? piece.marks[0]!;
        // A Find match has no card to light up, so hovering it does nothing.
        const itemMark = piece.marks.find((m) => m.kind !== 'find');
        const active = piece.marks.some((m) => m.itemId === activeId);
        const isCurrentFind = kind === 'find' && owner.itemId === currentFindId;
        return (
          <mark
            key={i}
            data-kind={kind}
            data-find-id={kind === 'find' ? owner.itemId : undefined}
            aria-current={isCurrentFind ? 'true' : undefined}
            onMouseEnter={itemMark ? () => onActive(itemMark.itemId) : undefined}
            onMouseLeave={itemMark ? () => onActive(null) : undefined}
            className={cn(
              'rounded-mark px-0.5 text-fg transition-shadow',
              MARK_STYLES[kind],
              active && 'ring-2 ring-accent/50',
              isCurrentFind && 'ring-2 ring-warning',
            )}
          >
            {piece.text}
          </mark>
        );
      })}
    </>
  );
}
