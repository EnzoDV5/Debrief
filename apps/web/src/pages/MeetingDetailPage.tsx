import type { Meeting } from '@debrief/shared';
import { CalendarDays, FileSearch, Rows3 } from 'lucide-react';
import { useParams } from 'react-router';
import { ApiError } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { MeetingDocument } from '@/features/meetings/document/MeetingDocument';
import { MeetingOverview } from '@/features/meetings/document/MeetingOverview';
import { useMeeting } from '@/features/meetings/hooks';
import { formatCalendarDate, plural } from '@/lib/format';
import { usePageTitle } from '@/lib/usePageTitle';

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
      <ErrorState
        title="Couldn't load this meeting"
        message={error.message}
        onRetry={() => void refetch()}
      />
    );
  }

  return <MeetingDetail meeting={meeting} />;
}

/**
 * The transcript is the primary document. The compact overview stays in reach while reading.
 */
function MeetingDetail({ meeting }: { meeting: Meeting }) {
  return (
    <div className="w-full">
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
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <MeetingDocument meeting={meeting} />
        <aside
          aria-label="Meeting overview"
          className="order-first xl:order-last xl:sticky xl:top-6"
        >
          <MeetingOverview meeting={meeting} />
        </aside>
      </div>
    </div>
  );
}

function MeetingNotFound() {
  usePageTitle('Meeting not found');
  return (
    <EmptyState
      icon={<FileSearch />}
      title="Meeting not found"
      description="It may have been deleted, or the link is wrong. Your meetings are in the sidebar."
      action={<Button to="/meetings">Start a new meeting</Button>}
    />
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading meeting" className="mx-auto max-w-6xl">
      <Skeleton className="h-8 w-2/3 max-w-md" />
      <Skeleton className="mt-3 h-4 w-1/2 max-w-xs" />
      <Skeleton className="mt-8 h-40 rounded-card" />
      <Skeleton className="mt-6 h-96 rounded-card" />
    </div>
  );
}
