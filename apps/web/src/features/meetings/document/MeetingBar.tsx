// The meeting page's top bar: title, status and actions.
import type { Meeting } from '@debrief/shared';
import { CalendarDays, ChevronDown, Pencil, RotateCcw, Rows3, SearchCheck } from 'lucide-react';
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Collapsible } from '@/components/ui/Collapsible';
import { Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { formatCalendarDate, plural } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';
import { AnalysisStatusBadge } from '../AnalysisStatusBadge';
import { useAnalyzeMeeting, useUpdateMeeting } from '../hooks';
import { ArchiveButton, BarButton, DeleteButton, ProjectMenu } from './MeetingBarActions';

const sourceLabels: Record<Meeting['sourceType'], string> = {
  paste: 'Pasted text',
  txt: 'Text file',
  vtt: 'VTT file',
  md: 'Markdown file',
};

// While the next meeting loads, the bar stays put: the title becomes a skeleton and the buttons
// pause, so nothing can act on the meeting you are leaving.
export function MeetingBar({ meeting, loading = false }: { meeting: Meeting; loading?: boolean }) {
  usePageTitle(meeting.title);
  const analyze = useAnalyzeMeeting(meeting.id);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [confirmRerun, setConfirmRerun] = useState(false);
  const summaryToggle = useRef<HTMLButtonElement>(null);
  const summaryId = useId();

  const running = meeting.analysisStatus === 'pending' || meeting.analysisStatus === 'processing';
  const analysed = meeting.summary !== null;
  const rerun = () => analyze.mutate(undefined, { onSuccess: () => setConfirmRerun(false) });

  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !summaryOpen || confirmRerun) return;
    summaryToggle.current?.focus();
    setSummaryOpen(false);
  };

  return (
    <div onKeyDown={closeOnEscape} className="px-4 pt-7 sm:px-8 lg:px-1 lg:pt-0 lg:pb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {loading ? (
          <div role="status" aria-label="Loading meeting" className="min-w-0 flex-1 space-y-2.5">
            <span className="block h-6 w-64 max-w-full animate-pulse rounded-md bg-fg/10 lg:bg-sidebar-strong/10" />
            <span className="block h-4 w-48 max-w-full animate-pulse rounded-md bg-fg/10 lg:bg-sidebar-strong/10" />
          </div>
        ) : (
          <div className="min-w-0 motion-safe:animate-step-in">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="min-w-0 text-2xl font-bold lg:truncate lg:text-xl lg:text-sidebar-strong">
                {meeting.title}
              </h1>
              <AnalysisStatusBadge status={meeting.analysisStatus} />
              {meeting.analysisStatus === 'done' &&
                meeting.actionItems.length === 0 &&
                meeting.decisions.length === 0 && (
                  <Badge tone="neutral" icon={<SearchCheck aria-hidden="true" />}>
                    Nothing found
                  </Badge>
                )}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted lg:text-sidebar-muted">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays aria-hidden="true" className="size-4" />
                {formatCalendarDate(meeting.meetingDate)}
              </span>
              <span className="inline-flex items-center gap-1.5 numeric">
                <Rows3 aria-hidden="true" className="size-4" />
                {plural(meeting.transcriptLines.length, 'line')} ·{' '}
                {sourceLabels[meeting.sourceType]}
              </span>
            </p>
          </div>
        )}

        <div
          inert={loading}
          className={cn(
            'flex shrink-0 flex-wrap items-center gap-2 transition-opacity',
            loading && 'opacity-60',
          )}
        >
          <BarButton
            ref={summaryToggle}
            aria-expanded={summaryOpen}
            aria-controls={summaryId}
            disabled={meeting.analysisStatus === 'failed'}
            title={
              meeting.analysisStatus === 'failed'
                ? 'No summary: the analysis failed. Retry it first.'
                : undefined
            }
            onClick={() => setSummaryOpen((open) => !open)}
          >
            Summary
            <ChevronDown
              aria-hidden="true"
              className={cn('size-4 transition-transform', summaryOpen && 'rotate-180')}
            />
          </BarButton>
          <ProjectMenu meeting={meeting} />
          <ArchiveButton meeting={meeting} />
          {analysed && !running && (
            <BarButton tone="highlight" onClick={() => setConfirmRerun(true)}>
              <RotateCcw aria-hidden="true" className="size-4" />
              Re-analyse
            </BarButton>
          )}
          <DeleteButton meeting={meeting} />
        </div>
      </div>

      {!loading && running && (
        <Alert className="mt-4">
          {meeting.analysisStatus === 'pending'
            ? 'Your transcript is saved. The AI will start reading it in a moment.'
            : 'The AI is reading the transcript. Results appear beside the text when it’s done.'}
        </Alert>
      )}
      {!loading && meeting.analysisStatus === 'failed' && (
        <Alert tone="danger" className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <p className="min-w-0 flex-1">
              {meeting.analysisError ?? 'Analysis failed. Your transcript is saved.'}
            </p>
            <Button size="sm" className="shrink-0" loading={analyze.isPending} onClick={rerun}>
              Retry analysis
            </Button>
          </div>
        </Alert>
      )}
      {analyze.error && (
        <Alert tone="danger" className="mt-4">
          {analyze.error.message}
        </Alert>
      )}

      {/* Opens instantly inside the top bar; the bar's own height animation then reveals it as
          the frame lowers, so the two move as one. */}
      <Collapsible id={summaryId} open={summaryOpen && meeting.analysisStatus !== 'failed'} instant>
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

function SummaryText({ meeting }: { meeting: Meeting }) {
  const update = useUpdateMeeting(meeting.id);
  const [draft, setDraft] = useState<string | null>(null);

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
      <BarButton onClick={() => setDraft(meeting.summary ?? '')} aria-label="Edit summary">
        <Pencil aria-hidden="true" className="size-4" />
        Edit
      </BarButton>
    </div>
  );
}
