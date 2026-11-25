// One meeting. Someone else's meeting just shows as not found.
import type { Meeting } from '@debrief/shared';
import { FileSearch } from 'lucide-react';
import { useParams } from 'react-router';
import { ApiError } from '@/api/client';
import { PageBar } from '@/components/layout/PageBar';
import { useShellPanelInset } from '@/components/layout/shellFrame';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState, LOAD_ERROR_MESSAGE } from '@/components/ui/ErrorState';
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
  const { data: meeting, isPending, isPlaceholderData, error, refetch } = useMeeting(meetingId);

  if (isPending) return <DetailSkeleton />;

  if (error) {
    if (error instanceof ApiError && error.status === 404) return <MeetingNotFound />;
    // Offline or a server hiccup: the same error as the full-screen one, without a card, in the
    // middle of the frame (its height minus the frame's margins and the page's padding).
    return (
      <div className="grid min-h-[60dvh] place-items-center lg:min-h-[calc(100dvh-7.5rem)]">
        <ErrorState
          variant="plain"
          title="Couldn't load this meeting"
          message={LOAD_ERROR_MESSAGE}
          details={error.message}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return <MeetingDetail meeting={meeting} loading={isPlaceholderData} />;
}

// Keyed by meeting id: each meeting starts fresh (closed summary, empty Ask box), while the
// frame around it stays where it is.
function MeetingDetail({ meeting, loading }: { meeting: Meeting; loading: boolean }) {
  return (
    <>
      <PageBar>
        <MeetingBar key={meeting.id} meeting={meeting} loading={loading} />
      </PageBar>
      <MeetingDocument key={meeting.id} meeting={meeting} loading={loading} />
    </>
  );
}

function MeetingNotFound() {
  usePageTitle('Meeting not found');
  // Plain and large like the Projects and Actions empty states, centred where this page's
  // load error sits.
  return (
    <div className="grid min-h-[60dvh] place-items-center lg:min-h-[calc(100dvh-7.5rem)]">
      <EmptyState
        icon={<FileSearch />}
        title="Meeting not found"
        description="It may have been deleted, or the link is wrong. Your meetings are in the sidebar."
        action={<Button to="/meetings">Start a new meeting</Button>}
        variant="plain"
        size="large"
      />
    </div>
  );
}

function DetailSkeleton() {
  useShellPanelInset(PANEL_INSET);
  return (
    <>
      <PageBar>
        <div aria-hidden="true" className="space-y-2.5 px-4 pt-7 sm:px-8 lg:px-1 lg:pt-0 lg:pb-5">
          <span className="block h-6 w-64 max-w-full animate-pulse rounded-md bg-fg/10 lg:bg-sidebar-strong/10" />
          <span className="block h-4 w-48 max-w-full animate-pulse rounded-md bg-fg/10 lg:bg-sidebar-strong/10" />
        </div>
      </PageBar>
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
    </>
  );
}
