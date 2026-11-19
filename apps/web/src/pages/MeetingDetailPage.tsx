import type { Meeting } from '@debrief/shared';
import { CalendarDays, ChevronDown, FileSearch, Pencil, Rows3, Trash2 } from 'lucide-react';
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
import { AnalysisPanel } from '@/features/meetings/AnalysisPanel';
import { DeleteMeetingDialog } from '@/features/meetings/DeleteMeetingDialog';
import { EditMeetingDialog } from '@/features/meetings/EditMeetingDialog';
import { useMeeting } from '@/features/meetings/hooks';
import { TranscriptView } from '@/features/meetings/TranscriptView';
import { formatCalendarDate, plural } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';
import { BackLink } from '@/components/layout/BackLink';

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
  const location = useLocation();
  const justCreated = (location.state as { created?: boolean } | null)?.created;
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(() => /^#L\d+$/.test(location.hash));

  return (
    <div className="mx-auto max-w-4xl">
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

      <AnalysisPanel meeting={meeting} onSourceJump={() => setTranscriptOpen(true)} />

      <Card className="mt-6 overflow-hidden">
        <button
          type="button"
          aria-expanded={transcriptOpen}
          aria-controls="meeting-transcript"
          onClick={() => setTranscriptOpen((open) => !open)}
          className="flex min-h-16 w-full items-center justify-between gap-3 px-5 text-left hover:bg-surface-2 sm:px-7"
        >
          <span>
            <span className="block font-bold">Transcript</span>
            <span className="block text-sm text-muted">
              Original source · {plural(meeting.transcriptLines.length, 'line')}
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`size-5 text-muted transition-transform ${transcriptOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {transcriptOpen && (
          <div
            id="meeting-transcript"
            className="max-h-[75vh] overflow-y-auto border-t border-line px-3 py-5 sm:px-6"
          >
            <TranscriptView lines={meeting.transcriptLines} />
          </div>
        )}
      </Card>

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
    </div>
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
