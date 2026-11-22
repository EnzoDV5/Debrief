// The looping demo on the sign-in page that shows how Debrief works.
import {
  CalendarCheck,
  CalendarDays,
  Check,
  FileText,
  Gavel,
  ListChecks,
  LoaderCircle,
  Plus,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { NoteCardHeader, cardChip, noteCardClass } from '@/features/actionItems/ActionItemCard';
import { GoogleLogo } from '@/components/ui/GoogleLogo';
import { Initials } from '@/components/ui/Initials';
import { cn } from '@/lib/cn';

type Mark = 'decision' | 'action' | 'date';
type Piece = string | { text: string; mark: Mark } | { text: string; pick: true };
type Line = { n: number; speaker: string; pieces: Piece[] };

const FILE_NAME = 'budget-check-in.vtt';

type Cast = { lead: string; second: string; third: string };
const CASTS: Cast[] = [
  { lead: 'John', second: 'Priya', third: 'Thandi' },
  { lead: 'Sofia', second: 'Marcus', third: 'Aisha' },
  { lead: 'Thandi', second: 'Daniel', third: 'Mei' },
  { lead: 'Liam', second: 'Fatima', third: 'Kenji' },
];

function transcriptFor({ lead, second, third }: Cast): Line[] {
  return [
    { n: 1, speaker: lead, pieces: ['Quick budget check-in before the launch.'] },
    {
      n: 2,
      speaker: second,
      pieces: [
        'Marketing is ready, so ',
        { text: 'let’s keep the launch on 3 March', mark: 'decision' },
        '.',
      ],
    },
    {
      n: 3,
      speaker: lead,
      pieces: [
        'I’ll ',
        { text: 'send the revised budget to finance', mark: 'action' },
        ' by ',
        { text: 'Friday', mark: 'date' },
        '.',
      ],
    },
    {
      n: 4,
      speaker: second,
      pieces: [
        `${third}, can you `,
        { text: 'book the venue for the launch party', mark: 'action' },
        '?',
      ],
    },
    {
      n: 5,
      speaker: third,
      pieces: [
        'Sure, leave it with me. ',
        { text: 'We should send the press kit early.', pick: true },
      ],
    },
    { n: 6, speaker: lead, pieces: ['Great, thanks everyone.'] },
  ];
}
const LINE_COUNT = 6;

type Note =
  | { kind: 'decision'; text: string }
  | { kind: 'action'; text: string; owner: string; due: string | null; byYou?: boolean };

function notesFor({ lead, third }: Cast): Record<number, Note> {
  return {
    2: { kind: 'decision', text: 'Launch stays on 3 March' },
    3: { kind: 'action', text: 'Send the revised budget to finance', owner: lead, due: 'Friday' },
    4: { kind: 'action', text: 'Book the venue for the launch party', owner: third, due: null },
    5: { kind: 'action', text: 'Send the press kit early', owner: third, due: null, byYou: true },
  };
}
const CALENDAR_LINE = 3;
const TICK_LINE = 4;
const PICK_LINE = 5;

const MARK_STYLES: Record<Mark, string> = {
  decision: 'bg-success-soft',
  action: 'bg-accent-soft',
  date: 'bg-spark/70 font-semibold',
};

const STAGES: { title: ReactNode; text: string }[] = [
  {
    title: (
      <>
        Meetings in. Decisions <span className="text-accent">out.</span>
      </>
    ),
    text: 'Drop in a transcript (.txt, .vtt or .md) or paste it.',
  },
  {
    title: 'Debrief reads it for you',
    text: 'Decisions and action items pop out beside the line they were said on.',
  },
  {
    title: 'Spotted something? Add it',
    text: 'Click a sentence or select words to make an action item or decision.',
  },
  {
    title: 'Put it in your calendar',
    text: 'One click adds an action with a due date to Google Calendar.',
  },
  {
    title: 'Tick it off when it’s done',
    text: 'Edit anything that’s off, and tick items off as they get done.',
  },
];

const ANALYSING_STEPS = [
  'Reading the transcript…',
  'Finding decisions…',
  'Finding action items…',
  'Done: 1 decision, 2 action items',
];

type PointerTarget = 'rest' | 'dropzone' | 'sentence' | 'pick-action' | 'calendar' | 'tick' | null;

type Beat = {
  ms: number;
  stage: number;
  screen: 'upload' | 'transcript';
  carrying: boolean;
  upload: 'empty' | 'over' | 'analysing';
  analysing: number;
  read: number;
  reading: number | null;
  focus: number | null;
  pointer: PointerTarget;
  click: boolean;
  pick: 'none' | 'hover' | 'toolbar' | 'added';
  calendar: 'idle' | 'adding' | 'added';
  ticked: boolean;
};

function timeline(changes: (Partial<Beat> & { ms: number })[]): Beat[] {
  let current: Beat = {
    ms: 0,
    stage: 0,
    screen: 'upload',
    carrying: false,
    upload: 'empty',
    analysing: 0,
    read: 0,
    reading: null,
    focus: null,
    pointer: 'rest',
    click: false,
    pick: 'none',
    calendar: 'idle',
    ticked: false,
  };
  return changes.map((change) => (current = { ...current, click: false, ...change }));
}

const TIMELINE = timeline([
  { ms: 1000, carrying: true },
  { ms: 1200, pointer: 'dropzone' },
  { ms: 600, upload: 'over' },
  { ms: 900, click: true, carrying: false, upload: 'analysing', analysing: 1 },
  { ms: 1000, pointer: null, analysing: 2 },
  { ms: 1000, analysing: 3 },
  { ms: 1100, analysing: 4 },
  { ms: 700, stage: 1, screen: 'transcript' },
  ...Array.from({ length: LINE_COUNT }, (_, i) => i + 1).map((n) => ({
    ms: 850,
    read: n,
    reading: n,
    focus: n,
  })),
  { ms: 1200, stage: 2, reading: null, focus: PICK_LINE, pointer: 'sentence' },
  { ms: 500, pick: 'hover' },
  { ms: 1000, click: true, pick: 'toolbar' },
  { ms: 900, pointer: 'pick-action' },
  { ms: 1600, click: true, pick: 'added' },
  { ms: 1300, stage: 3, focus: CALENDAR_LINE, pointer: 'calendar' },
  { ms: 900, click: true, calendar: 'adding' },
  { ms: 1500, calendar: 'added' },
  { ms: 1200, stage: 4, focus: TICK_LINE, pointer: 'tick' },
  { ms: 2000, click: true, ticked: true },
  { ms: 1600, pointer: 'rest' },
]);

const CAST_CHANGE_STEP = TIMELINE.findIndex((beat) => beat.upload === 'analysing');

const SCROLL_STIFFNESS = 11;

function offsetWithin(el: HTMLElement, ancestor: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

function titleClass(index: number, stage: number, delay: string) {
  const base = 'transition-[opacity,translate,filter]';
  if (index === stage) {
    return cn(base, 'translate-y-0 opacity-100 blur-[0px] duration-900 ease-panel', delay);
  }
  return cn(
    base,
    'opacity-0 blur-md duration-400 ease-out-3',
    index < stage ? '-translate-y-3' : 'translate-y-3',
  );
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export function HowItWorksDemo() {
  const [reduced] = useState(prefersReducedMotion);
  const [index, setIndex] = useState(() => (reduced ? TIMELINE.length - 1 : 0));
  const beat = TIMELINE[index]!;
  const [loop, setLoop] = useState(-1);
  const cast = CASTS[Math.max(loop, 0) % CASTS.length]!;
  const transcript = useMemo(() => transcriptFor(cast), [cast]);
  const notes = useMemo(() => notesFor(cast), [cast]);

  const windowRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const scroll = useRef({ target: 0, position: 0, velocity: 0 });

  useEffect(() => {
    if (reduced) return;
    const timer = setTimeout(() => {
      const next = (index + 1) % TIMELINE.length;
      if (next === CAST_CHANGE_STEP) setLoop((l) => l + 1);
      setIndex(next);
    }, beat.ms);
    return () => clearTimeout(timer);
  }, [index, beat.ms, reduced]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || reduced || typeof window.requestAnimationFrame !== 'function') return;
    const damping = 2 * Math.sqrt(SCROLL_STIFFNESS);
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const s = scroll.current;
      const acceleration = SCROLL_STIFFNESS * (s.target - s.position) - damping * s.velocity;
      s.velocity += acceleration * dt;
      s.position += s.velocity * dt;
      scroller.scrollTop = s.position;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  useEffect(() => {
    const frame = windowRef.current;
    const scroller = scrollerRef.current;
    const bar = barRef.current;
    const pointer = pointerRef.current;
    if (!frame || !scroller || !bar || !pointer) return;
    const find = (selector: string) => frame.querySelector<HTMLElement>(selector);

    const focusRow = beat.focus ? find(`[data-line="${beat.focus}"]`) : null;
    const maxTop = scroller.scrollHeight - scroller.clientHeight;
    const centred = focusRow
      ? offsetWithin(focusRow, scroller).y + focusRow.offsetHeight / 2 - scroller.clientHeight / 2
      : 0;
    const top = Math.min(maxTop, Math.max(0, centred));
    scroll.current.target = top;
    if (reduced || typeof window.requestAnimationFrame !== 'function') {
      scroll.current.position = top;
      scroller.scrollTop = top;
    }

    const lineBox = find(`[data-line-box="${beat.reading ?? 1}"]`);
    if (lineBox) {
      const at = offsetWithin(lineBox, scroller);
      bar.style.transform = `translate(${at.x}px, ${at.y}px)`;
      bar.style.width = `${lineBox.offsetWidth}px`;
      bar.style.height = `${lineBox.offsetHeight}px`;
    }
    bar.style.opacity = beat.reading ? '1' : '0';

    if (beat.pointer && !reduced) {
      let x = frame.clientWidth * 0.84;
      let y = frame.clientHeight * 0.8;
      const target = beat.pointer === 'rest' ? null : find(`[data-pointer="${beat.pointer}"]`);
      if (target) {
        const at = offsetWithin(target, frame);
        const inTranscript = scroller.contains(target);
        x = at.x + Math.min(target.offsetWidth / 2, 28);
        y = at.y - (inTranscript ? top : 0) + Math.min(target.offsetHeight / 2, 14);
      }
      pointer.style.transform = `translate(${x}px, ${y}px)`;
      pointer.style.opacity = '1';
    } else {
      pointer.style.opacity = '0';
    }
  }, [beat, reduced]);

  const on = (target: PointerTarget) => beat.pointer === target;
  const transcriptShown = beat.screen === 'transcript';

  return (
    <figure className="flex h-full w-full flex-col">
      <figcaption className="sr-only">
        How Debrief works: drop in a meeting transcript and Debrief pulls out the decisions and
        action items, showing each one beside the line it came from. Click any sentence to add your
        own, add actions to your calendar, and tick them off when they&apos;re done.
      </figcaption>

      <div aria-hidden="true" className="flex min-h-0 flex-1 flex-col justify-center">
        <div className="mx-auto grid w-full max-w-xl text-center">
          {STAGES.map(({ title, text }, i) => (
            <div key={i} className="col-start-1 row-start-1">
              <p className={cn('text-3xl font-bold', titleClass(i, beat.stage, 'delay-150'))}>
                {title}
              </p>
              <p className={cn('mt-3 text-muted', titleClass(i, beat.stage, 'delay-300'))}>
                {text}
              </p>
            </div>
          ))}
        </div>

        <div ref={windowRef} className="relative mt-10 max-h-136 min-h-104 flex-1">
          <UploadScreen beat={beat} shown={!transcriptShown} />

          <div
            ref={scrollerRef}
            className={cn(
              'absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,#000_3rem,#000_calc(100%-4rem),transparent)]',
              'transition-[opacity,scale,filter] duration-700 ease-panel',
              transcriptShown
                ? 'scale-100 opacity-100 blur-[0px]'
                : 'scale-[0.97] opacity-0 blur-sm',
            )}
          >
            <div
              ref={barRef}
              className="pointer-events-none absolute top-0 left-0 rounded-md bg-accent-soft/70 opacity-0 transition-[transform,width,height,opacity] duration-700 ease-panel"
            />

            <div className="px-5 pt-10 pb-48">
              <div className="mb-3 flex items-end justify-between gap-4 border-b border-line pb-3">
                <div>
                  <p className="text-lg font-bold">Transcript</p>
                  <p className="text-sm text-muted">Budget check-in · {transcript.length} lines</p>
                </div>
                <span className={cn(cardChip, 'bg-surface-2 text-muted')}>
                  <FileText className="size-3.5" />
                  {FILE_NAME}
                </span>
              </div>

              {transcript.map((line, i) => {
                const read = line.n <= beat.read;
                const note = notes[line.n];
                const newSpeaker = line.speaker !== transcript[i - 1]?.speaker;
                return (
                  <div
                    key={line.n}
                    data-line={line.n}
                    className="grid grid-cols-[minmax(0,1fr)_16rem] items-start gap-x-8"
                  >
                    <div className={cn('py-2', newSpeaker && i > 0 && 'pt-5')}>
                      <div
                        data-line-box={line.n}
                        className="relative -mx-3 grid scroll-spotlight-soft grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 px-3 py-1"
                      >
                        <span className="pt-0.5 text-right font-mono text-xs text-muted tabular-nums">
                          {line.n}
                        </span>
                        <div className="min-w-0">
                          {newSpeaker && <p className="mb-0.5 font-bold">{line.speaker}</p>}
                          <p className="leading-7 text-fg/90">
                            {line.pieces.map((piece, p) =>
                              typeof piece === 'string' ? (
                                <span key={p}>{piece}</span>
                              ) : 'pick' in piece ? (
                                <PickSentence key={p} text={piece.text} beat={beat} on={on} />
                              ) : (
                                <mark
                                  key={p}
                                  className={cn(
                                    'rounded-mark px-0.5 text-fg transition-colors duration-700 ease-panel',
                                    read ? MARK_STYLES[piece.mark] : 'bg-transparent',
                                  )}
                                >
                                  {piece.text}
                                </mark>
                              ),
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="scroll-spotlight py-2">
                      {note && (
                        <NoteCard
                          note={note}
                          line={line.n}
                          shown={
                            note.kind === 'action' && note.byYou ? beat.pick === 'added' : read
                          }
                          active={
                            (line.n === CALENDAR_LINE && on('calendar')) ||
                            (line.n === TICK_LINE && on('tick'))
                          }
                          calendar={line.n === CALENDAR_LINE ? beat.calendar : 'idle'}
                          calendarHovered={line.n === CALENDAR_LINE && on('calendar')}
                          done={line.n === TICK_LINE && beat.ticked}
                          tickHovered={line.n === TICK_LINE && on('tick')}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Pointer ref={pointerRef} clickKey={beat.click ? index : null} carrying={beat.carrying} />
        </div>
      </div>
    </figure>
  );
}

function UploadScreen({ beat, shown }: { beat: Beat; shown: boolean }) {
  const analysing = beat.upload === 'analysing';
  const step = Math.max(beat.analysing, 1);
  const finished = beat.analysing >= ANALYSING_STEPS.length;
  return (
    <div
      className={cn(
        'absolute inset-0 flex items-start justify-center px-6 pt-14 transition-[opacity,scale,filter] duration-700 ease-panel',
        shown ? 'scale-100 opacity-100 blur-[0px]' : 'scale-[1.03] opacity-0 blur-sm',
      )}
    >
      <div
        data-pointer="dropzone"
        className={cn(
          'grid min-h-64 w-full max-w-md place-items-center rounded-card border-2 border-dashed px-6 py-10 text-center transition-[border-color,background-color,scale] duration-500 ease-panel',
          beat.upload === 'over'
            ? 'scale-[1.02] border-accent bg-accent-soft'
            : analysing
              ? 'border-accent/30 bg-surface/80'
              : 'border-line-strong/60 bg-surface/70',
        )}
      >
        <div
          className={cn(
            'col-start-1 row-start-1 flex flex-col items-center gap-3 transition-[opacity,translate] duration-500 ease-panel',
            analysing ? '-translate-y-2 opacity-0' : 'opacity-100',
          )}
        >
          <span
            className={cn(
              'grid size-14 place-items-center rounded-pill bg-accent-soft text-accent transition-transform duration-500 ease-panel',
              beat.upload === 'over' && '-translate-y-1 scale-110',
            )}
          >
            <Upload className="size-7" />
          </span>
          <span className="text-lg font-bold">Drop a transcript here</span>
          <span className="text-sm text-muted">.txt, .vtt or .md · up to 1 MB</span>
        </div>

        <div
          className={cn(
            'col-start-1 row-start-1 flex w-full flex-col items-center gap-4 transition-[opacity,translate] duration-500 ease-panel',
            analysing ? 'opacity-100' : 'translate-y-2 opacity-0',
          )}
        >
          <span className="inline-flex items-center gap-2.5 font-semibold">
            <span className="grid size-10 place-items-center rounded-pill bg-accent-soft text-accent">
              <FileText className="size-5" />
            </span>
            {FILE_NAME}
          </span>
          <div className="h-2 w-full max-w-xs overflow-hidden rounded-pill bg-surface-2">
            <div
              className={cn(
                'h-full rounded-pill transition-[width,background-color] duration-1000 ease-panel',
                finished ? 'bg-success' : 'bg-accent',
              )}
              style={{ width: analysing ? `${(step / ANALYSING_STEPS.length) * 100}%` : '0%' }}
            />
          </div>
          <span
            key={step}
            className={cn(
              'inline-flex animate-page-in items-center gap-1.5 text-sm',
              finished ? 'font-semibold text-success' : 'text-muted',
            )}
          >
            {finished && <Check className="size-4" />}
            {ANALYSING_STEPS[step - 1]}
          </span>
        </div>
      </div>
    </div>
  );
}

function PickSentence({
  text,
  beat,
  on,
}: {
  text: string;
  beat: Beat;
  on: (target: PointerTarget) => boolean;
}) {
  const hovered = beat.pick === 'hover' || beat.pick === 'toolbar';
  const toolbar = beat.pick === 'toolbar';
  return (
    <span className="relative inline-block">
      <span
        data-pointer="sentence"
        className={cn(
          'rounded-mark px-0.5 text-fg transition-colors duration-500 ease-panel',
          beat.pick === 'added'
            ? 'bg-accent-soft'
            : hovered
              ? 'bg-accent-soft/60'
              : 'bg-transparent',
        )}
      >
        {text}
      </span>
      <span
        className={cn(
          'ml-1 inline-grid size-5 place-items-center rounded-pill bg-accent align-middle text-accent-fg shadow-card ring-2 ring-bg transition-opacity duration-300',
          hovered ? 'opacity-100' : 'opacity-0',
        )}
      >
        <Plus className="size-3.5" strokeWidth={3} />
      </span>

      <span
        className={cn(
          'absolute bottom-full left-0 z-10 mb-1.5 flex gap-1 rounded-pill border border-white/70 glass-float p-1 whitespace-nowrap shadow-raised transition-[opacity,translate,scale] duration-300 ease-panel',
          toolbar ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-1 scale-95 opacity-0',
        )}
      >
        <span
          data-pointer="pick-action"
          className={cn(
            'inline-flex min-h-8 items-center gap-1.5 rounded-pill px-3 text-sm font-semibold text-fg transition-colors',
            on('pick-action') && 'bg-surface-2',
          )}
        >
          <ListChecks className="size-4 text-accent" />
          Action item
        </span>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-pill px-3 text-sm font-semibold text-fg">
          <Gavel className="size-4 text-success" />
          Decision
        </span>
      </span>
    </span>
  );
}

function Pointer({
  ref,
  clickKey,
  carrying,
}: {
  ref: Ref<HTMLDivElement>;
  clickKey: number | null;
  carrying: boolean;
}) {
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute top-0 left-0 z-20 opacity-0 transition-[transform,opacity] duration-1000 ease-panel"
    >
      <span
        className={cn(
          cardChip,
          'absolute top-4 left-3 border border-line bg-surface font-semibold whitespace-nowrap text-fg shadow-raised transition-[opacity,scale,rotate] duration-500 ease-panel',
          carrying ? 'scale-100 -rotate-3 opacity-100' : 'scale-75 rotate-0 opacity-0',
        )}
      >
        <FileText className="size-3.5 text-accent" />
        {FILE_NAME}
      </span>
      {clickKey !== null && (
        <span
          key={clickKey}
          className="absolute -top-5 -left-5 size-10 animate-click-ripple rounded-pill bg-accent/35"
        />
      )}
      <svg
        key={clickKey ?? 'still'}
        viewBox="0 0 24 24"
        className={cn(
          'absolute -top-0.5 -left-0.75 size-6 origin-[3px_2px] drop-shadow-md',
          clickKey !== null && 'animate-click-press',
        )}
      >
        <path
          d="M3 2v16.5l4.4-4.2 2.9 6.6 2.9-1.3-2.9-6.4H16.5z"
          fill="var(--color-fg)"
          stroke="#fff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function NoteCard({
  note,
  line,
  shown,
  active,
  calendar,
  calendarHovered,
  done,
  tickHovered,
}: {
  note: Note;
  line: number;
  shown: boolean;
  active: boolean;
  calendar: Beat['calendar'];
  calendarHovered: boolean;
  done: boolean;
  tickHovered: boolean;
}) {
  return (
    <div
      className={cn(
        noteCardClass(note.kind, active),
        'p-3.5 text-sm transition-[opacity,translate,scale,filter,box-shadow] duration-700 ease-panel',
        shown
          ? 'translate-y-0 scale-100 opacity-100 blur-[0px]'
          : 'translate-y-4 scale-95 opacity-0 blur-sm',
      )}
    >
      <NoteCardHeader kind={note.kind} line={line} />
      {note.kind === 'decision' ? (
        <p className="mt-1.5 leading-snug font-semibold">{note.text}</p>
      ) : (
        <div className="mt-1.5 flex items-start gap-2.5">
          <span
            data-pointer={line === TICK_LINE ? 'tick' : undefined}
            className={cn(
              'mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors duration-300',
              done
                ? 'border-accent bg-accent text-accent-fg'
                : tickHovered
                  ? 'border-accent bg-surface'
                  : 'border-line-strong bg-surface',
            )}
          >
            <Check
              strokeWidth={3}
              className={cn(
                'size-3 transition-[scale] duration-300 ease-panel',
                done ? 'scale-100' : 'scale-0',
              )}
            />
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                'leading-snug font-semibold line-through transition-colors duration-500',
                done ? 'text-muted decoration-muted' : 'decoration-transparent',
              )}
            >
              {note.text}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={cn(cardChip, 'bg-surface-2 pl-1 text-fg')}>
                <Initials name={note.owner} />
                {note.owner}
              </span>
              <span className={cn(cardChip, 'bg-surface-2', !note.due && 'text-muted')}>
                <CalendarDays className="size-3.5" />
                {note.due ?? 'No due date'}
              </span>
            </div>
            {note.byYou && <p className="mt-2 text-xs text-muted">Added by you</p>}
            {note.due && (
              <span
                data-pointer={line === CALENDAR_LINE ? 'calendar' : undefined}
                className={cn(
                  'mt-1.5 -ml-2.5 inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 font-semibold transition-colors duration-300',
                  calendar === 'added' ? 'text-success' : 'text-accent',
                  calendarHovered && calendar === 'idle' && 'bg-accent-soft',
                )}
              >
                {calendar === 'idle' && <GoogleLogo className="size-4" />}
                {calendar === 'adding' && <LoaderCircle className="size-4 animate-spin" />}
                {calendar === 'added' && <CalendarCheck className="size-4" />}
                {calendar === 'idle'
                  ? 'Add to calendar'
                  : calendar === 'adding'
                    ? 'Adding…'
                    : 'Added to calendar'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
