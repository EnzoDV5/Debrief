import type { Meeting } from '@debrief/shared';
import { FileSearch } from 'lucide-react';
import { useParams } from 'react-router';
import { ApiError } from '@/api/client';
import { PageBar } from '@/components/layout/PageBar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { MeetingDocument } from '@/features/meetings/document/MeetingDocument';
import { MeetingBar } from '@/features/meetings/document/MeetingBar';
import { useMeeting } from '@/features/meetings/hooks';
import { usePageTitle } from '@/lib/usePageTitle';

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
 * The title, summary and Ask live in a bar above the transcript panel (see MeetingBar), so the
 * panel holds just the transcript with its action items and decisions beside the lines.
 */
function MeetingDetail({ meeting }: { meeting: Meeting }) {
  return (
    <>
      <PageBar>
        <MeetingBar key={meeting.id} meeting={meeting} />
      </PageBar>
      <MeetingDocument meeting={meeting} />
    </>
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
