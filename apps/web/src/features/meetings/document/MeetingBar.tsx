import type { Meeting } from '@debrief/shared';
import { CalendarDays, ChevronDown, Pencil, RotateCcw, Rows3 } from 'lucide-react';
import {
  useId,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Collapsible } from '@/components/ui/Collapsible';
import { Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { formatCalendarDate, plural } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';
import { AnalysisStatusBadge } from '../AnalysisStatusBadge';
import { useAnalyzeMeeting, useUpdateMeeting } from '../hooks';

const sourceLabels: Record<Meeting['sourceType'], string> = {
  paste: 'Pasted text',
  txt: 'Text file',
  vtt: 'VTT file',
  md: 'Markdown file',
};

/**
 * The meeting page's top bar, rendered above the transcript panel (see PageBar).
 * Desktop: it sits on the dark frame, so the title, status and actions stay in view while the
 * transcript scrolls. Summary opens under the bar and the transcript panel shrinks to make
 * room. Mobile: the same bar at the top of the page. (Ask lives in the transcript panel.)
 */
export function MeetingBar({ meeting }: { meeting: Meeting }) {
  usePageTitle(meeting.title);
  const analyze = useAnalyzeMeeting(meeting.id);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [confirmRerun, setConfirmRerun] = useState(false);
  const summaryToggle = useRef<HTMLButtonElement>(null);
  const summaryId = useId();

  const running = meeting.analysisStatus === 'pending' || meeting.analysisStatus === 'processing';
  const analysed = meeting.summary !== null;
  const rerun = () => analyze.mutate(undefined, { onSuccess: () => setConfirmRerun(false) });

  // Esc closes the summary and returns focus to its button (the panel becomes inert, so
  // focus can't stay inside it).
  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !summaryOpen || confirmRerun) return;
    summaryToggle.current?.focus();
    setSummaryOpen(false);
  };

  return (
    <div onKeyDown={closeOnEscape} className="px-4 pt-7 sm:px-8 lg:px-1 lg:pt-0 lg:pb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {/* The analysis status sits with the title it describes. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="min-w-0 text-2xl font-bold lg:truncate lg:text-xl lg:text-white">
              {meeting.title}
            </h1>
            <AnalysisStatusBadge status={meeting.analysisStatus} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted lg:text-sidebar-muted">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-4" />
              {formatCalendarDate(meeting.meetingDate)}
            </span>
            <span className="inline-flex items-center gap-1.5 numeric">
              <Rows3 aria-hidden="true" className="size-4" />
              {plural(meeting.transcriptLines.length, 'line')} · {sourceLabels[meeting.sourceType]}
            </span>
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <BarButton
            ref={summaryToggle}
            aria-expanded={summaryOpen}
            aria-controls={summaryId}
            onClick={() => setSummaryOpen((open) => !open)}
          >
            Summary
            <ChevronDown
              aria-hidden="true"
              className={cn('size-4 transition-transform', summaryOpen && 'rotate-180')}
            />
          </BarButton>
          {analysed && !running && (
            <BarButton onClick={() => setConfirmRerun(true)}>
              <RotateCcw aria-hidden="true" className="size-4" />
              Re-analyse
            </BarButton>
          )}
        </div>
      </div>

      {/* Progress and failures stay visible: they aren't hidden inside a closed panel. */}
      {running && (
        <Alert className="mt-4">
          {meeting.analysisStatus === 'pending'
            ? 'Your transcript is saved. The AI will start reading it in a moment.'
            : 'The AI is reading the transcript. Results appear beside the text when it’s done.'}
        </Alert>
      )}
      {meeting.analysisStatus === 'failed' && (
        <Alert tone="danger" className="mt-4">
          <p>{meeting.analysisError ?? 'Analysis failed. Your transcript is saved.'}</p>
          <Button size="sm" className="mt-3" loading={analyze.isPending} onClick={rerun}>
            Retry analysis
          </Button>
        </Alert>
      )}
      {analyze.error && (
        <Alert tone="danger" className="mt-4">
          {analyze.error.message}
        </Alert>
      )}

      <Collapsible id={summaryId} open={summaryOpen}>
        {/* No card: the summary reads as plain text on the page (light) or the dark frame. */}
        <section
          aria-label="Meeting summary"
          className="px-1 lg:scrollbar-panel lg:max-h-[40vh] lg:overflow-y-auto lg:pr-3 lg:text-sidebar-fg"
        >
          <h2 className="text-lg font-bold">Summary</h2>
          {analysed ? (
            <SummaryText meeting={meeting} />
          ) : (
            <p className="mt-3 text-muted lg:text-sidebar-muted">
              The summary appears here once the AI has read the transcript.
            </p>
          )}
        </section>
      </Collapsible>

      <Dialog
        open={confirmRerun}
        onClose={() => !analyze.isPending && setConfirmRerun(false)}
        title="Re-analyse this meeting?"
        description="The new analysis replaces the AI’s decisions and action items, including edits you made to them. Items you added yourself stay."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            disabled={analyze.isPending}
            onClick={() => setConfirmRerun(false)}
          >
            Cancel
          </Button>
          <Button loading={analyze.isPending} onClick={rerun}>
            Re-analyse
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

/**
 * A bar action. Light glass on mobile (page background); on desktop it matches the dark frame
 * it sits on, like the sidebar's items. Highlighted while its panel is open.
 */
function BarButton({ className, ...props }: ComponentProps<'button'>) {
  const expanded = props['aria-expanded'] === true;
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors',
        'border-line-strong bg-surface/60 text-fg shadow-card hover:bg-surface',
        'lg:border-sidebar-line lg:bg-sidebar-hover lg:text-sidebar-fg lg:shadow-none lg:hover:bg-sidebar-active lg:hover:text-white lg:focus-visible:outline-white',
        expanded && 'bg-accent-soft text-accent lg:bg-sidebar-active lg:text-white',
        className,
      )}
    />
  );
}

function SummaryText({ meeting }: { meeting: Meeting }) {
  const update = useUpdateMeeting(meeting.id);
  const [draft, setDraft] = useState<string | null>(null); // null = not editing

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (draft !== null) update.mutate({ summary: draft }, { onSuccess: () => setDraft(null) });
  };

  if (draft !== null) {
    return (
      <form onSubmit={save} className="mt-3 space-y-3">
        <Textarea
          aria-label="Summary text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={5}
          autoFocus
        />
        {update.error && <Alert tone="danger">{update.error.message}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={update.isPending}>
            Save
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setDraft(null)}
            disabled={update.isPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-3 flex items-start gap-3">
      <p className="flex-1 text-base leading-7 whitespace-pre-wrap">{meeting.summary}</p>
      <BarButton
        onClick={() => setDraft(meeting.summary ?? '')}
        // Explicit label: a visually hidden " summary" span can lose its space ("Editsummary").
        aria-label="Edit summary"
      >
        <Pencil aria-hidden="true" className="size-4" />
        Edit
      </BarButton>
    </div>
  );
}
