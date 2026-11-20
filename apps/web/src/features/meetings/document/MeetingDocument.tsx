import type { ActionItem, Decision, Meeting, TranscriptLine } from '@debrief/shared';
import { TextSelect } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { useShellPanelInset } from '@/components/layout/shellFrame';
import { ActionItemDialog } from '@/features/actionItems/ActionItemDialog';
import { cn } from '@/lib/cn';
import { AskMeetingPanel } from './AskMeetingPanel';
import { DecisionBubble } from './DecisionBubble';
import { findPhrase, segment, type Mark } from './highlight';
import { MeetingActionCard } from './MeetingActionCard';
import { NewDecisionDialog } from './NewDecisionDialog';
import {
  PickToolbar,
  pickText,
  sentencesOf,
  useTranscriptSelection,
  type PickKind,
  type PickToolbarState,
  type TranscriptPick,
} from './transcriptPick';

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

// Layout. From xl each row has two cells: the transcript (on the sheet) and its notes (beside
// it, on the dark frame). Narrower, the notes stack under their line, inside the sheet.
const columns =
  'xl:grid xl:grid-cols-[minmax(0,1fr)_var(--notes)] xl:items-start xl:gap-x-[var(--gap)]';
const sheetCell = 'px-4 sm:px-8';
// Where the shell's panel ends on wide screens: the notes width + the gap + the scrollbar, which
// sits beside the panel and always keeps its space (14px, see scrollbar-panel in base.css).
// Must match --notes and --gap on the section below.
const PANEL_INSET = 'xl:right-[calc(24rem+1.5rem+14px)] 2xl:right-[calc(27rem+1.5rem+14px)]';
const notesCell = 'px-4 sm:px-8 xl:px-0';
// Under their line (narrow): indented to the text. Beside it (xl): solid cards, since see-through
// glass turns grey on the dark frame, each in the scroll spotlight (base.css).
const cardsCell =
  'space-y-3 pb-3 pl-16 sm:pl-22 xl:py-2.5 xl:pl-0 xl:[&_.glass]:bg-surface xl:[&_.glass]:bg-none xl:[&>*]:scroll-spotlight';

/**
 * The transcript: a sheet with each line, and beside it the notes column with Ask at the top
 * and each line's action items and decisions (sharing a row, so both sides scroll together). New items come from the text itself:
 * click a sentence or select words, then choose Action item or Decision.
 */
export function MeetingDocument({ meeting }: { meeting: Meeting }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const { hash } = useLocation();
  const targetLine = lineFromHash(hash);

  // Pull the shell's rounded panel in from the right, making room for the notes column.
  useShellPanelInset(PANEL_INSET);

  // Click a sentence / select words / Enter on a line → toolbar → a pre-filled item.
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

  // Bring a linked line into view once it exists (after a reload or from a shared link).
  useEffect(() => {
    if (targetLine !== null) {
      document.getElementById(`L${targetLine}`)?.scrollIntoView?.({ block: 'center' });
    }
  }, [targetLine, meeting.transcriptLines]);

  return (
    // --notes / --gap: the notes column's width and the gap beside the sheet (wide screens).
    <section
      aria-labelledby="transcript-title"
      className="relative min-w-0 pb-10 text-fg [--gap:1.5rem] [--notes:24rem] 2xl:[--notes:27rem]"
    >
      {/* Header row: the transcript heading (on the panel) and Ask this meeting (top of the notes
          column, level with the panel's top edge). On wide screens the Ask cell becomes a
          full-height track down the notes column (absolute, against the section) with the card
          sticky inside it: it stays in view while the transcript scrolls, and the cards slide up
          underneath it. The row is just tall enough for the card at rest, so nothing sits under
          it until the page scrolls. */}
      <div className={cn(columns, 'xl:min-h-31 xl:items-stretch')}>
        <div className={cn(sheetCell, 'flex flex-col pt-7 lg:pt-9')}>
          <div className="flex-1 border-b border-line pb-4">
            <h2 id="transcript-title" className="text-lg font-bold">
              Transcript
            </h2>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted">
              <TextSelect aria-hidden="true" className="size-4" />
              Click a sentence or select words to make an action item or decision
              <span className="sr-only">
                . With the keyboard, press Enter on a line to do the same.
              </span>
            </p>
          </div>
        </div>
        <div
          className={cn(
            notesCell,
            'pt-4 pb-3 xl:pointer-events-none xl:absolute xl:inset-y-0 xl:right-0 xl:z-20 xl:flex xl:w-(--notes) xl:flex-col xl:p-0',
          )}
        >
          {/* The track ignores the mouse (the cards below it stay clickable); the card doesn't.
              Its frame-coloured backing hides cards sliding under it (behind the rounded corners
              too), then fades out below it, so cards dissolve rather than being cut off. */}
          <div className="xl:sticky xl:top-0 xl:z-10">
            <div className="xl:pointer-events-auto xl:bg-sidebar xl:pb-2">
              <AskMeetingPanel meetingId={meeting.id} />
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none hidden h-10 bg-linear-to-b from-sidebar to-transparent xl:block"
            />
          </div>
          {/* The same soft fade along the bottom edge of the column. */}
          <div
            aria-hidden="true"
            className="pointer-events-none sticky bottom-0 mt-auto hidden h-20 bg-linear-to-t from-sidebar to-transparent xl:block"
          />
        </div>
      </div>

      <ol ref={transcriptRef} className="relative pt-3">
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
                columns,
                'scroll-mt-24',
                // Off-screen plain lines skip rendering (smooth on 1 MB transcripts).
                !notes && '[contain-intrinsic-size:auto_3rem] [content-visibility:auto]',
              )}
            >
              {/* Spacing lives inside the sheet cell, so the sheet has no gaps between rows. */}
              <div className={cn(sheetCell, 'py-2.5', newSpeaker && i > 0 && 'pt-7')}>
                <div
                  className={cn(
                    '-mx-3 grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 rounded-md px-3 sm:grid-cols-[2.75rem_minmax(0,1fr)]',
                    line.n === targetLine && 'bg-accent-soft/60',
                  )}
                >
                  <a
                    href={`#L${line.n}`}
                    aria-label={`Line ${line.n}`}
                    // The line text below is the line's tab stop; one per line is plenty.
                    tabIndex={-1}
                    className="pt-0.5 text-right font-mono text-xs text-muted tabular-nums hover:text-accent"
                  >
                    {line.n}
                  </a>
                  <div className="min-w-0">
                    {newSpeaker && <p className="mb-1 text-base font-bold">{line.speaker}</p>}
                    {/* data-line-text: what a selection reads (see transcriptPick.tsx).
                        Focusable so keyboard users can make an item from a line with Enter. */}
                    <p
                      data-line-text={line.n}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        const box = event.currentTarget.getBoundingClientRect();
                        setToolbar({
                          pick: pickText(line.n, line.text),
                          x: box.left + Math.min(box.width / 2, 160),
                          y: box.top,
                          source: 'click',
                          focus: true,
                        });
                      }}
                      className="rounded-md text-lg leading-8 wrap-break-word text-fg/90 sm:text-xl sm:leading-9"
                    >
                      <LineText
                        line={line}
                        marks={marksFor(line, notes)}
                        activeId={activeId}
                        onActive={setActiveId}
                        onPick={setToolbar}
                      />
                    </p>
                  </div>
                </div>
              </div>
              {notes && (notes.items.length > 0 || notes.decisions.length > 0) && (
                <div className={cn(notesCell, cardsCell)}>
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
        <section aria-label="Notes without a transcript line" className={cn(columns, 'relative')}>
          <div className={cn(sheetCell, 'pt-8')}>
            <div className="border-t border-line pt-6">
              <h3 className="font-semibold">Other notes</h3>
              <p className="mt-1 text-sm text-muted">
                These actions and decisions have no verified transcript line.
              </p>
            </div>
          </div>
          <div className={cn(notesCell, cardsCell, 'xl:pt-14')}>
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
};

// Where marks overlap, the first kind here wins the colour.
const MARK_PRIORITY: Mark['kind'][] = ['date', 'action', 'decision'];

/**
 * A line's text, one hoverable, clickable span per sentence, with the item highlights inside.
 * Clicking a sentence opens the Action item / Decision toolbar for it. A click that ends a text
 * selection is left to the selection toolbar instead.
 */
function LineText({
  line,
  marks,
  activeId,
  onActive,
  onPick,
}: {
  line: TranscriptLine;
  marks: Mark[];
  activeId: string | null;
  onActive: (id: string | null) => void;
  onPick: (state: PickToolbarState) => void;
}) {
  return (
    <>
      {sentencesOf(line.text).map((sentence) => {
        const text = line.text.slice(sentence.start, sentence.end);
        // This sentence's share of each highlight, measured from the sentence's start.
        const local = marks
          .filter((m) => m.end > sentence.start && m.start < sentence.end)
          .map((m) => ({
            ...m,
            start: Math.max(m.start, sentence.start) - sentence.start,
            end: Math.min(m.end, sentence.end) - sentence.start,
          }));
        return (
          <span
            key={sentence.start}
            onClick={(event) => {
              if (!(window.getSelection()?.isCollapsed ?? true)) return;
              onPick({
                pick: pickText(line.n, text),
                x: event.clientX,
                y: event.clientY - 6,
                source: 'click',
              });
            }}
            className="cursor-pointer rounded-mark transition-colors hover:bg-accent-soft/60"
          >
            {segment(text, local).map((piece, i) => {
              if (piece.marks.length === 0) return <span key={i}>{piece.text}</span>;
              const kind = MARK_PRIORITY.find((k) => piece.marks.some((m) => m.kind === k))!;
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
          </span>
        );
      })}
    </>
  );
}
