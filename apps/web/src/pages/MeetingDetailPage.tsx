import type { Meeting } from '@debrief/shared';
import { CalendarDays, FileSearch, Pencil, Rows3, Sparkles, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { ApiError } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { AnalysisStatusBadge } from '@/features/meetings/AnalysisStatusBadge';
import { DeleteMeetingDialog } from '@/features/meetings/DeleteMeetingDialog';
import { EditMeetingDialog } from '@/features/meetings/EditMeetingDialog';
import { useMeeting } from '@/features/meetings/hooks';
import { TranscriptView } from '@/features/meetings/TranscriptView';
import { formatCalendarDate, plural } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';
import { BackLink } from './NewMeetingPage';

const sourceLabels: Record<Meeting['sourceType'], string> = {
  paste: 'Pasted text',
  txt: 'Text file',
  vtt: 'VTT file',
  md: 'Markdown file',
};

export function MeetingDetailPage() {
  const { meetingId = '' } = useParams();
  const { data: meeting, isPending, error, refetch } = useMeeting(meetingId);

  if (isPending) return <DetailSkeleton />;

  if (error) {
    // Someone else's meeting and a meeting that doesn't exist look the same (api returns 404).
    if (error instanceof ApiError && error.status === 404) return <MeetingNotFound />;
    return (
      <>
        <BackLink />
        <ErrorState
          title="Couldn't load this meeting"
          message={error.message}
          onRetry={() => void refetch()}
        />
      </>
    );
  }

  return <MeetingDetail meeting={meeting} />;
}

function MeetingDetail({ meeting }: { meeting: Meeting }) {
  const navigate = useNavigate();
  const justCreated = (useLocation().state as { created?: boolean } | null)?.created;
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null);

  return (
    <>
      <BackLink />
      <PageHeader
        title={meeting.title}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-4" />
              {formatCalendarDate(meeting.meetingDate)}
            </span>
            <span className="inline-flex items-center gap-1.5 numeric">
              <Rows3 aria-hidden="true" className="size-4" />
              {plural(meeting.transcriptLines.length, 'line')} · {sourceLabels[meeting.sourceType]}
            </span>
          </span>
        }
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Pencil aria-hidden="true" className="size-4" />}
              onClick={() => setDialog('edit')}
            >
              Edit
            </Button>
            <Button
              variant="dangerOutline"
              icon={<Trash2 aria-hidden="true" className="size-4" />}
              onClick={() => setDialog('delete')}
            >
              Delete
            </Button>
          </>
        }
      />

      {justCreated && (
        <Alert tone="success" className="mb-6">
          Meeting saved. The transcript is stored safely and ready for analysis.
        </Alert>
      )}

      {/* Desktop: analysis beside the transcript (it'll cite line numbers from Phase 3).
          Mobile: stacked, analysis first because it's the summary of everything below. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <Card className="p-5 sm:p-6 lg:sticky lg:top-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Analysis</h2>
            <AnalysisStatusBadge status={meeting.analysisStatus} />
          </div>
          <div className="mt-5 flex flex-col items-center rounded-md bg-surface-2 px-6 py-10 text-center">
            <div
              aria-hidden="true"
              className="mb-3 grid size-11 place-items-center rounded-pill bg-accent-soft text-accent"
            >
              <Sparkles className="size-5" />
            </div>
            <p className="font-semibold">Summary, decisions and action items appear here</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              AI analysis is the next feature being built. Your transcript is already saved and
              numbered, ready for it.
            </p>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Transcript</h2>
            <span className="text-sm text-muted numeric">
              {plural(meeting.transcriptLines.length, 'line')}
            </span>
          </div>
          <TranscriptView lines={meeting.transcriptLines} />
        </Card>
      </div>

      <EditMeetingDialog
        meeting={meeting}
        open={dialog === 'edit'}
        onClose={() => setDialog(null)}
      />
      <DeleteMeetingDialog
        meeting={meeting}
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        onDeleted={() =>
          navigate('/meetings', { replace: true, state: { deleted: meeting.title } })
        }
      />
    </>
  );
}

function MeetingNotFound() {
  usePageTitle('Meeting not found');
  return (
    <>
      <BackLink />
      <EmptyState
        icon={<FileSearch />}
        title="Meeting not found"
        description="It may have been deleted, or the link is wrong."
        action={<Button to="/meetings">Go to your meetings</Button>}
      />
    </>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading meeting">
      <Skeleton className="mb-6 h-4 w-28" />
      <Skeleton className="h-8 w-2/3 max-w-md" />
      <Skeleton className="mt-3 h-4 w-1/2 max-w-xs" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <Skeleton className="h-64 rounded-card" />
        <Skeleton className="h-96 rounded-card" />
      </div>
    </div>
  );
}
