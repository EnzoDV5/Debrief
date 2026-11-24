// The meeting page: transcript on the left, notes lined up next to the lines they came from.
import {
  EDIT_WHILE_ANALYSING_MESSAGE,
  type ActionItem,
  type Decision,
  type Meeting,
  type TranscriptLine,
} from '@debrief/shared';
import { Pencil, Plus, TextSelect, UserRound } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router';
import { useShellPanelInset } from '@/components/layout/shellFrame';
import { Skeleton } from '@/components/ui/Skeleton';
import { ActionItemDialog } from '@/features/actionItems/ActionItemDialog';
import { cn } from '@/lib/cn';
import { useLingering } from '@/lib/useLingering';
import { highlightFrom } from '../noteLink';
import { AnalysisNotesLoader } from './AnalysisNotesLoader';
import { AskMeetingPanel } from './AskMeetingPanel';
import { keepRowCentered, scrollRowToCenter } from './centerRow';
import { DecisionBubble } from './DecisionBubble';
import { findPhrase, segment, type Mark } from './highlight';
import { MeetingActionCard } from './MeetingActionCard';
import { NewDecisionDialog } from './NewDecisionDialog';
import { NoNotesFound } from './NoNotesFound';
import { SpeakerEditor } from './SpeakerEditor';
import { TranscriptLineEditor } from './TranscriptLineEditor';
import { TranscriptMap, type MapMarker } from './TranscriptMap';
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

function lineFromHash(hash: string): number | null {
  const match = /^#L(\d+)$/.exec(hash);
  return match ? Number(match[1]) : null;
}

function findQuote(line: TranscriptLine, quote: string | null) {
  if (!quote) return null;
  return (
    findPhrase(line.text, quote) ?? findPhrase(line.text, quote.replace(/^[^:]{1,40}:\s*/, ''))
  );
}

function marksFor(line: TranscriptLine, notes: Annotations | undefined): Mark[] {
  if (!notes) return [];
  const marks: Mark[] = [];
  for (const item of notes.items) {
    const edited = item.editedAt !== null;
    const quote = findQuote(line, item.sourceQuote);
    if (quote) marks.push({ ...quote, kind: 'action', itemId: item.id, edited });
    const date = item.dueDateText ? findPhrase(line.text, item.dueDateText) : null;
    if (date) marks.push({ ...date, kind: 'date', itemId: item.id, edited });
  }
  for (const decision of notes.decisions) {
    marks.push({
      start: 0,
      end: line.text.length,
      kind: 'decision',
      itemId: decision.id,
      edited: decision.editedAt !== null,
    });
  }
  return marks;
}

const columns =
  'xl:grid xl:grid-cols-[minmax(0,1fr)_var(--notes)] xl:items-start xl:gap-x-[var(--gap)]';
const sheetCell = 'px-4 sm:px-8';
export const PANEL_INSET = 'xl:right-[calc(24rem+1.5rem+14px)] 2xl:right-[calc(27rem+1.5rem+14px)]';
export const PANEL_INSET_MARGIN =
  'xl:mr-[calc(24rem+1.5rem+14px)] 2xl:mr-[calc(27rem+1.5rem+14px)]';
const notesCell = 'px-4 sm:px-8 xl:px-0';
// xl:pr-4 (here and on the Ask column) leaves room on the right for a card's highlight ring and
// arrival ripple: the scrolling panel clips anything drawn past its edge.
// The spotlight measures from below the Ask card and its 2.5rem fade (--spotlight-top), so a card
// is sharp whenever it's fully in view there and only blurs as it slides under the Ask card.
const cardsCell =
  'space-y-3 pb-3 pl-16 sm:pl-22 xl:py-2.5 xl:pr-4 xl:pl-0 xl:[&_.glass]:bg-surface xl:[&_.glass]:bg-none xl:[--spotlight-top:calc(var(--notes-head,9rem)+2.5rem)] xl:[&>*]:scroll-spotlight-edges';

export function MeetingDocument({
  meeting,
  loading = false,
}: {
  meeting: Meeting;
  loading?: boolean;
}) {
  const { hash, state, key: locationKey } = useLocation();
  const targetLine = lineFromHash(hash);
  // The card you clicked on the Actions page or in search: it starts highlighted, together with
  // its words in the transcript, until you point at another card.
  const highlightId = highlightFrom(state);
  const [activeId, setActiveId] = useState<string | null>(highlightId);
  // A new jump while this page is open (e.g. from search) highlights the new card instead.
  // Adjusting state during render is React's recommended way to react to a changed prop.
  const [jumpKey, setJumpKey] = useState(locationKey);
  if (jumpKey !== locationKey) {
    setJumpKey(locationKey);
    if (highlightId) setActiveId(highlightId);
  }
  const analysisRunning =
    meeting.analysisStatus === 'pending' || meeting.analysisStatus === 'processing';

  useShellPanelInset(PANEL_INSET, 'transcript-edge-fade');

  const transcriptRef = useRef<HTMLOListElement>(null);
  const notesHeadRef = useRef<HTMLDivElement>(null);
  const [notesHead, setNotesHead] = useState(0);
  useEffect(() => {
    const head = notesHeadRef.current;
    if (!head || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setNotesHead(head.offsetHeight));
    observer.observe(head);
    return () => observer.disconnect();
  }, []);
  const [toolbar, setToolbar] = useState<PickToolbarState | null>(null);
  const [creating, setCreating] = useState<{ kind: PickKind; pick: TranscriptPick } | null>(null);
  // One line at a time can be open for fixing its words or for saying who spoke it.
  const [editingLine, setEditingLine] = useState<{ n: number; part: 'text' | 'speaker' } | null>(
    null,
  );
  // Keeps the dialog on screen while it animates out after closing.
  const shownCreating = useLingering(creating);
  // Shortly after the page opens, any card that appears is "new" and gets the grow-in entrance.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  useTranscriptSelection(transcriptRef, setToolbar);
  const closeToolbar = useCallback(() => setToolbar(null), []);
  const choose = (kind: PickKind) => {
    if (!toolbar || analysisRunning) return;
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

  // Each decision's tasks, in their usual order, for the task list on its card.
  const tasksByDecision = useMemo(() => {
    const map = new Map<string, ActionItem[]>();
    for (const item of meeting.actionItems) {
      if (!item.decisionId) continue;
      map.set(item.decisionId, [...(map.get(item.decisionId) ?? []), item]);
    }
    return map;
  }, [meeting.actionItems]);

  // A task clicked in a decision's list: glide its card to the middle and highlight it.
  const jumpToTask = (item: ActionItem) => {
    const card = document.getElementById(`action-${item.id}`);
    if (!card) return;
    setActiveId(item.id);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    scrollRowToCenter(
      card.closest<HTMLElement>('li[id^="L"]') ?? card,
      notesHeadRef.current,
      reduce ? 'auto' : 'smooth',
    );
  };

  const lineNumbers = useMemo(
    () => meeting.transcriptLines.map((line) => line.n),
    [meeting.transcriptLines],
  );
  const noteOrder = useMemo(
    () => new Map([...byLine.keys()].sort((a, b) => a - b).map((line, index) => [line, index])),
    [byLine],
  );

  // When the AI finishes while you watch, glide the first card to the middle of the screen.
  const wasRunning = useRef(analysisRunning);
  useEffect(() => {
    const finished = wasRunning.current && meeting.analysisStatus === 'done';
    wasRunning.current = analysisRunning;
    const first = noteOrder.keys().next().value;
    if (!finished || first === undefined) return;
    const row = document.getElementById(`L${first}`);
    if (!row) return;
    // Wait for its card to finish growing open, so we centre the row at its final height.
    let done = false;
    const center = () => {
      if (done || !row.isConnected) return;
      done = true;
      row.removeEventListener('animationend', onGrown);
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      scrollRowToCenter(row, notesHeadRef.current, reduce ? 'auto' : 'smooth');
    };
    const onGrown = (event: AnimationEvent) => {
      if (event.animationName === 'card-grow') center();
    };
    row.addEventListener('animationend', onGrown);
    // Fallback when nothing grows (reduced motion). card-grow lasts 560ms (styles/tokens.css).
    window.setTimeout(center, 700);
    // No cleanup on purpose: a refetch right after "done" re-runs this effect, and cancelling
    // here would drop the scroll. `done` and `isConnected` make a late call harmless.
  }, [meeting.analysisStatus, analysisRunning, noteOrder]);

  const mapMarkers = useMemo(() => {
    const markers: MapMarker[] = [];
    for (const [line, notes] of [...byLine].sort(([a], [b]) => a - b)) {
      if (notes.decisions.length > 0) {
        markers.push({ line, kind: 'decision', label: `decision: ${notes.decisions[0]!.text}` });
      }
      if (notes.items.length > 0) {
        const more = notes.items.length > 1 ? ` (+${notes.items.length - 1} more)` : '';
        markers.push({
          line,
          kind: 'action',
          label: `action item: ${notes.items[0]!.text}${more}`,
        });
      }
    }
    return markers;
  }, [byLine]);

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

  // Arriving with #L15 (e.g. from a card on the Actions page): centre that line and its cards.
  useEffect(() => {
    const row = targetLine === null ? null : document.getElementById(`L${targetLine}`);
    const list = transcriptRef.current;
    if (!row || !list) return;
    return keepRowCentered(row, notesHeadRef.current, list);
  }, [targetLine, meeting.transcriptLines, loading]);

  return (
    <section
      aria-labelledby="transcript-title"
      style={notesHead ? ({ '--notes-head': `${notesHead}px` } as CSSProperties) : undefined}
      className="relative min-w-0 pb-10 text-fg [--gap:1.5rem] [--notes:24rem] lg:pb-[45dvh] 2xl:[--notes:27rem]"
    >
      {/* As tall as the Ask card, so this row's bottom border lines up with the card's bottom edge.
          --notes-head is the measured Ask box, which has 0.5rem (pb-2) of padding under the card. */}
      <div
        className={cn(columns, 'xl:min-h-[calc(var(--notes-head,9rem)-0.5rem)] xl:items-stretch')}
      >
        <div className={cn(sheetCell, 'flex flex-col pt-7 lg:pt-9')}>
          <div className="flex-1 border-b border-line pb-4">
            <h2 id="transcript-title" className="text-2xl font-bold">
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
            'pt-4 pb-3 xl:pointer-events-none xl:absolute xl:inset-y-0 xl:right-0 xl:z-20 xl:flex xl:w-(--notes) xl:flex-col xl:p-0 xl:pr-4',
          )}
        >
          <div className="xl:sticky xl:top-0 xl:z-10">
            <div ref={notesHeadRef} className="xl:pointer-events-auto xl:bg-sidebar xl:pb-2">
              <AskMeetingPanel
                meetingId={meeting.id}
                disabledReason={
                  meeting.analysisStatus === 'failed'
                    ? 'Retry the analysis first, then you can ask about this meeting.'
                    : undefined
                }
              />
              {!loading && <NoNotesFound meeting={meeting} />}
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none hidden h-10 bg-linear-to-b from-sidebar to-transparent xl:block"
            />
            {/* Inside the Ask card's sticky box, so it stays exactly still while the transcript
                scrolls. (As its own sticky box it started lower than where it stuck, so it
                drifted up 56px first.) mt-14 + the 2.5rem fade = 6rem below the Ask card. */}
            {analysisRunning && !loading && (
              <div className="mt-12 px-4 pb-8 xl:mt-14 xl:px-0 xl:pb-0">
                <AnalysisNotesLoader />
              </div>
            )}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none sticky bottom-0 mt-auto hidden h-20 bg-linear-to-t from-sidebar to-transparent xl:block"
          />
        </div>
      </div>

      {loading ? (
        <TranscriptSkeleton />
      ) : (
        <>
          {/* xl:pt-10: line 1's card starts below the Ask card's fade (0.5rem + 2.5rem under it). */}
          <ol ref={transcriptRef} className="relative pt-3 motion-safe:animate-step-in xl:pt-10">
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
                    // Jumps land just under the Ask card on wide screens (its height is measured).
                    'scroll-mt-24 xl:scroll-mt-[calc(var(--notes-head,9rem)+1.25rem)]',
                    !notes && '[contain-intrinsic-size:auto_3rem] [content-visibility:auto]',
                  )}
                >
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
                        tabIndex={-1}
                        className="pt-0.5 text-right font-mono text-xs text-muted tabular-nums hover:text-accent"
                      >
                        {line.n}
                      </a>
                      <div className="min-w-0">
                        {editingLine?.n === line.n && editingLine.part === 'speaker' ? (
                          <SpeakerEditor
                            meetingId={meeting.id}
                            line={line}
                            suggestions={ownerSuggestions}
                            onDone={() => setEditingLine(null)}
                          />
                        ) : (
                          newSpeaker && <p className="mb-1 text-base font-bold">{line.speaker}</p>
                        )}
                        {editingLine?.n === line.n && editingLine.part === 'text' ? (
                          <TranscriptLineEditor
                            meetingId={meeting.id}
                            line={line}
                            onDone={() => setEditingLine(null)}
                          />
                        ) : (
                          <>
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
                            {(line.edited || line.speakerEdited) && (
                              <p className="mt-1 flex flex-wrap gap-x-3 text-xs font-semibold text-muted">
                                {line.edited && (
                                  <span className="inline-flex items-center gap-1">
                                    <Pencil aria-hidden="true" className="size-3" />
                                    Edited
                                  </span>
                                )}
                                {line.speakerEdited && (
                                  <span className="inline-flex items-center gap-1">
                                    <UserRound aria-hidden="true" className="size-3" />
                                    {line.speaker
                                      ? `Speaker set by you: ${line.speaker}`
                                      : 'Speaker removed by you'}
                                  </span>
                                )}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {notes && (notes.items.length > 0 || notes.decisions.length > 0) && (
                    <div className={cn(notesCell, cardsCell)}>
                      {notes.decisions.map((decision) => (
                        <CardEntrance
                          key={decision.id}
                          late={settled}
                          delay={Math.min(noteOrder.get(line.n) ?? 0, 8) * 80}
                          flash={highlightId === decision.id ? 'decision' : null}
                        >
                          <DecisionBubble
                            meeting={meeting}
                            decision={decision}
                            tasks={tasksByDecision.get(decision.id)}
                            ownerSuggestions={ownerSuggestions}
                            onJumpToTask={jumpToTask}
                            active={activeId === decision.id}
                            onActiveChange={(active) => setActiveId(active ? decision.id : null)}
                          />
                        </CardEntrance>
                      ))}
                      {notes.items.map((item) => (
                        <CardEntrance
                          key={item.id}
                          late={settled}
                          delay={Math.min(noteOrder.get(line.n) ?? 0, 8) * 80}
                          flash={highlightId === item.id ? 'action' : null}
                        >
                          <MeetingActionCard
                            meeting={meeting}
                            item={item}
                            ownerSuggestions={ownerSuggestions}
                            active={activeId === item.id}
                            onActiveChange={(active) => setActiveId(active ? item.id : null)}
                          />
                        </CardEntrance>
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
              className={cn(columns, 'relative')}
            >
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
                  <DecisionBubble
                    key={decision.id}
                    meeting={meeting}
                    decision={decision}
                    tasks={tasksByDecision.get(decision.id)}
                    ownerSuggestions={ownerSuggestions}
                    onJumpToTask={jumpToTask}
                  />
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
        </>
      )}

      {!loading && (
        <TranscriptMap listRef={transcriptRef} lines={lineNumbers} markers={mapMarkers} />
      )}
      {toolbar && (
        <PickToolbar
          state={toolbar}
          onChoose={choose}
          onEdit={() => {
            setEditingLine({ n: toolbar.pick.line, part: 'text' });
            setToolbar(null);
            window.getSelection()?.removeAllRanges();
          }}
          onSpeaker={() => {
            setEditingLine({ n: toolbar.pick.line, part: 'speaker' });
            setToolbar(null);
            window.getSelection()?.removeAllRanges();
          }}
          hasSpeaker={Boolean(
            meeting.transcriptLines.find((line) => line.n === toolbar.pick.line)?.speaker,
          )}
          // While the AI reads the transcript, it can't change and nothing new can point at it.
          lockedReason={analysisRunning ? EDIT_WHILE_ANALYSING_MESSAGE : undefined}
          onClose={closeToolbar}
        />
      )}
      {shownCreating?.kind === 'action' && (
        <ActionItemDialog
          open={creating?.kind === 'action'}
          onClose={() => setCreating(null)}
          meetingId={meeting.id}
          ownerSuggestions={ownerSuggestions}
          initialText={shownCreating.pick.text}
          source={{ line: shownCreating.pick.line, quote: shownCreating.pick.quote }}
          transcriptLine={meeting.transcriptLines.find(
            (line) => line.n === shownCreating.pick.line,
          )}
          decisions={meeting.decisions}
        />
      )}
      {shownCreating?.kind === 'decision' && (
        <NewDecisionDialog
          open={creating?.kind === 'decision'}
          meetingId={meeting.id}
          onClose={() => setCreating(null)}
          initialText={shownCreating.pick.text}
          sourceLine={shownCreating.pick.line}
        />
      )}
    </section>
  );
}

// Cards there when the page opens slide in one after another. A card added later first grows its
// row open, so the transcript below glides down instead of jumping. The outer div is left free for
// the scroll spotlight effect; the inner one animates. `flash` marks the card you jumped to: it
// ripples once it has arrived (after its entrance: card-in is 520ms, card-grow 560ms).
function CardEntrance({
  late,
  delay,
  flash = null,
  children,
}: {
  late: boolean;
  delay: number;
  flash?: 'action' | 'decision' | null;
  children: ReactNode;
}) {
  const [grows] = useState(late);
  const card = (
    <div
      className={cn(
        flash && 'rounded-card motion-safe:animate-note-flash',
        flash === 'decision' && '[--flash:var(--color-success)]',
      )}
      style={flash ? { animationDelay: `${grows ? 560 : delay + 520}ms` } : undefined}
    >
      {children}
    </div>
  );
  return (
    <div>
      {grows ? (
        <div className="grid grid-rows-[1fr] motion-safe:animate-card-grow">
          <div className="min-h-0 overflow-clip [overflow-clip-margin:1rem]">{card}</div>
        </div>
      ) : (
        <div className="motion-safe:animate-card-in" style={{ animationDelay: `${delay}ms` }}>
          {card}
        </div>
      )}
    </div>
  );
}

// Shown in the frame while the next meeting loads, so the page never goes blank.
function TranscriptSkeleton() {
  return (
    <div role="status" aria-label="Loading meeting" className={columns}>
      <div className={cn(sheetCell, 'space-y-7 pt-6')}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[2.75rem_minmax(0,1fr)]"
          >
            <Skeleton className="mt-1 ml-auto h-3 w-5" />
            <div className="space-y-2.5">
              {i % 2 === 0 && <Skeleton className="h-4 w-32" />}
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const MARK_STYLES: Record<Mark['kind'], string> = {
  decision: 'bg-success-soft',
  action: 'bg-accent-soft',
  date: 'bg-spark/70 font-semibold',
};

const EDITED_MARK_STYLES: Record<Mark['kind'], string> = {
  decision: 'decoration-success',
  action: 'decoration-accent',
  date: 'decoration-accent font-semibold',
};

// The phrase of the card you're pointing at, or jumped to from Actions: a clear tint and a solid
// ring, so it stands out from the soft everyday highlights. Applied last, so it wins over both.
const ACTIVE_MARK_STYLES: Record<Mark['kind'], string> = {
  decision: 'bg-success/20 ring-2 ring-success',
  action: 'bg-accent/20 ring-2 ring-accent',
  date: 'bg-spark ring-2 ring-accent',
};

const MARK_PRIORITY: Mark['kind'][] = ['date', 'action', 'decision'];

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
            className="group/sentence cursor-pointer rounded-mark transition-colors hover:bg-accent/15"
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
                  data-active={active || undefined}
                  data-edited={owner.edited ? 'true' : undefined}
                  title={
                    owner.edited ? 'Card edited since. This is the original source.' : undefined
                  }
                  onMouseEnter={() => onActive(owner.itemId)}
                  onMouseLeave={() => onActive(null)}
                  className={cn(
                    'rounded-mark px-0.5 text-fg transition-shadow',
                    owner.edited
                      ? cn(
                          'bg-transparent underline decoration-dashed decoration-2 underline-offset-4',
                          EDITED_MARK_STYLES[kind],
                        )
                      : MARK_STYLES[kind],
                    active && ACTIVE_MARK_STYLES[kind],
                  )}
                >
                  {piece.text}
                </mark>
              );
            })}
            <span aria-hidden="true" className="relative inline-block w-0 align-middle">
              <span className="pointer-events-none absolute top-1/2 left-0.5 grid size-5 -translate-y-1/2 place-items-center rounded-pill bg-accent text-accent-fg opacity-0 shadow-card ring-2 ring-bg transition-opacity group-hover/sentence:pointer-events-auto group-hover/sentence:opacity-100">
                <Plus className="size-3.5" strokeWidth={3} />
              </span>
            </span>
          </span>
        );
      })}
    </>
  );
}
