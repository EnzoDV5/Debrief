import { Archive } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { MeetingResults } from '@/features/meetings/MeetingResults';
import { useMeetings } from '@/features/meetings/hooks';

export function ArchivedPage() {
  const { data, isPending, error, refetch } = useMeetings({ archived: true });
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Archived meetings"
        description="Meetings kept for reference, away from your recent list."
      />
      {isPending ? (
        <p className="text-muted">Loading archived meetings…</p>
      ) : error ? (
        <ErrorState
          title="Couldn't load archived meetings"
          message={error.message}
          onRetry={() => void refetch()}
        />
      ) : data?.length ? (
        <MeetingResults meetings={data} />
      ) : (
        <EmptyState
          icon={<Archive />}
          title="No archived meetings"
          description="Archived meetings will appear here."
        />
      )}
    </div>
  );
}
