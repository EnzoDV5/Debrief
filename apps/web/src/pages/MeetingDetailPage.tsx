// One meeting. Someone else's meeting just shows as not found.
import type { Meeting } from '@debrief/shared';
import { FileSearch } from 'lucide-react';
import { useParams } from 'react-router';
import { ApiError } from '@/api/client';
import { PageBar } from '@/components/layout/PageBar';
import { useShellPanelInset } from '@/components/layout/shellFrame';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  MeetingDocument,
  PANEL_INSET,
  PANEL_INSET_MARGIN,
} from '@/features/meetings/document/MeetingDocument';
import { MeetingBar } from '@/features/meetings/document/MeetingBar';
import { useMeeting } from '@/features/meetings/hooks';
import { cn } from '@/lib/cn';
import { usePageTitle } from '@/lib/usePageTitle';

export function MeetingDetailPage() {
  const { meetingId = '' } = useParams();
  const { data: meeting, isPending, error, refetch } = useMeeting(meetingId);

  if (isPending) return <DetailSkeleton />;

  if (error) {
    if (error instanceof ApiError && error.status === 404) return <MeetingNotFound />;
    return (
      <ErrorState
        title="Couldn't load this meeting"
        message={error.message}
        onRetry={() => void refetch()}
      />
    );
  }

  return <MeetingDetail key={meeting.id} meeting={meeting} />;
}

function MeetingDetail({ meeting }: { meeting: Meeting }) {
  return (
    <>
      <PageBar>
        <MeetingBar meeting={meeting} />
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
  useShellPanelInset(PANEL_INSET);
  return (
    <div
      role="status"
      aria-label="Loading meeting"
      className={cn('px-4 py-7 sm:px-8 lg:py-10', PANEL_INSET_MARGIN)}
    >
      <Skeleton className="h-8 w-2/3 max-w-md" />
      <Skeleton className="mt-3 h-4 w-1/2 max-w-xs" />
      <Skeleton className="mt-8 h-40 rounded-card" />
      <Skeleton className="mt-6 h-96 rounded-card" />
    </div>
  );
}
