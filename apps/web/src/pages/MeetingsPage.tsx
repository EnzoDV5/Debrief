import type { AnalysisStatus, MeetingListItem } from '@debrief/shared';
import { CalendarDays, ChevronRight, FileText, Plus, Rows3, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCurrentUser } from '@/features/auth/hooks';
import { AnalysisStatusBadge } from '@/features/meetings/AnalysisStatusBadge';
import { useMeetings } from '@/features/meetings/hooks';
import { formatCalendarDate, plural } from '@/lib/format';

type LocationState = { welcome?: boolean; deleted?: string } | null;

export function MeetingsPage() {
  const user = useCurrentUser();
  const state = useLocation().state as LocationState;
  const { data: meetings, isPending, error, refetch } = useMeetings();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AnalysisStatus | 'all'>('all');
  const hasMeetings = Boolean(meetings?.length);
  const query = search.trim().toLocaleLowerCase();
  const visibleMeetings = meetings?.filter(
    (meeting) =>
      meeting.title.toLocaleLowerCase().includes(query) &&
      (status === 'all' || meeting.analysisStatus === status),
  );

  return (
    <>
      <PageHeader
        title="Meetings"
        description="Find a meeting, revisit its analysis, or start with a new transcript."
        // Only once there's a list (on an empty page the empty state's button is the one action),
        // and not on phones, where the top bar's "New" button is right above it.
        actions={
          hasMeetings && (
            <div className="hidden sm:block">
              <Button to="/meetings/new" icon={<Plus aria-hidden="true" className="size-4" />}>
                New meeting
              </Button>
            </div>
          )
        }
      />

      {state?.welcome && (
        <Alert
          tone="success"
          title={`Welcome to Debrief, ${user.name.split(' ')[0]}!`}
          className="mb-6"
        >
          Add your first meeting to get its summary, decisions and action items.
        </Alert>
      )}
      {state?.deleted && (
        <Alert tone="success" className="mb-6">
          Deleted &ldquo;{state.deleted}&rdquo;.
        </Alert>
      )}

      {isPending ? (
        <MeetingListSkeleton />
      ) : error ? (
        <ErrorState
          title="Couldn't load your meetings"
          message={error.message}
          onRetry={() => void refetch()}
        />
      ) : hasMeetings ? (
        <>
          <div className="mb-5 flex flex-col gap-3 rounded-card border border-line bg-surface p-3 shadow-card sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
              />
              <input
                type="search"
                aria-label="Search all meetings"
                placeholder="Search by meeting title"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 w-full rounded-md bg-surface-2 pr-3 pl-10 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
            <select
              aria-label="Filter by analysis status"
              value={status}
              onChange={(event) => setStatus(event.target.value as AnalysisStatus | 'all')}
              className="h-11 rounded-md border border-line bg-surface px-3 text-sm font-medium text-fg"
            >
              <option value="all">All statuses</option>
              <option value="done">Analysed</option>
              <option value="pending">Waiting</option>
              <option value="processing">Analysing</option>
              <option value="failed">Needs attention</option>
            </select>
          </div>
          <p className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">
            {visibleMeetings?.length ?? 0} of {meetings?.length ?? 0} meetings
          </p>
          {visibleMeetings?.length ? (
            <ul className="space-y-2">
              {visibleMeetings.map((meeting) => (
                <li key={meeting.id}>
                  <MeetingCard meeting={meeting} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Search />}
              title="No matching meetings"
              description="Try another title or analysis status."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setStatus('all');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )}
        </>
      ) : (
        <EmptyState
          icon={<FileText />}
          title="No meetings yet"
          description="Paste a transcript or upload a .txt, .vtt or .md file. Debrief pulls out the summary, the decisions and every action item with its owner and due date."
          action={
            <Button to="/meetings/new" icon={<Plus aria-hidden="true" className="size-4" />}>
              Add your first meeting
            </Button>
          }
        />
      )}
    </>
  );
}

/** The whole card is one link: a big, easy target on a phone. */
function MeetingCard({ meeting }: { meeting: MeetingListItem }) {
  return (
    <Link
      to={`/meetings/${meeting.id}`}
      className="group flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card transition-all hover:border-accent/50 hover:shadow-raised sm:p-5"
    >
      <div
        aria-hidden="true"
        className="hidden size-11 shrink-0 place-items-center rounded-md bg-accent-soft text-accent sm:grid"
      >
        <FileText className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-bold group-hover:text-accent">{meeting.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays aria-hidden="true" className="size-4" />
            {formatCalendarDate(meeting.meetingDate)}
          </span>
          <span className="inline-flex items-center gap-1.5 numeric">
            <Rows3 aria-hidden="true" className="size-4" />
            {plural(meeting.lineCount, 'line')}
          </span>
          <AnalysisStatusBadge status={meeting.analysisStatus} />
        </div>
      </div>
      <ChevronRight
        aria-hidden="true"
        className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
      />
    </Link>
  );
}

function MeetingListSkeleton() {
  return (
    <div role="status" aria-label="Loading meetings" className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-card border border-line bg-surface p-5">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="mt-3 h-4 w-3/5" />
        </div>
      ))}
    </div>
  );
}
