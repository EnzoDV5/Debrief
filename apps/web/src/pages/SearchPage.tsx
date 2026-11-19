import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { MeetingResults } from '@/features/meetings/MeetingResults';
import { useMeetings } from '@/features/meetings/hooks';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const { data, isPending, error, refetch } = useMeetings(q.trim() ? { q: q.trim() } : {});
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Search meetings"
        description="Find a meeting by its title or anything said in its transcript."
      />
      <label className="relative mb-6 block">
        <Search
          aria-hidden="true"
          className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          aria-label="Search meetings"
          autoFocus
          placeholder="Search titles and transcripts"
          value={q}
          onChange={(event) =>
            setParams(event.target.value ? { q: event.target.value } : {}, { replace: true })
          }
          className="h-12 w-full rounded-md border border-line-strong bg-surface pr-4 pl-12 text-fg outline-none focus:border-accent"
        />
      </label>
      {isPending ? (
        <p className="text-muted">Searching…</p>
      ) : error ? (
        <ErrorState
          title="Couldn't search meetings"
          message={error.message}
          onRetry={() => void refetch()}
        />
      ) : data?.length ? (
        <MeetingResults meetings={data} />
      ) : (
        <EmptyState
          icon={<Search />}
          title={q ? 'No matching meetings' : 'Search your meetings'}
          description={
            q
              ? 'Try different words from a title or transcript.'
              : 'Type a word or phrase to find a meeting.'
          }
        />
      )}
    </div>
  );
}
