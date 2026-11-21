// Meeting cards inside an expanded project, with direct open and remove actions.
import type { MeetingListItem } from '@debrief/shared';
import { ArrowUpRight, CalendarDays, FolderMinus } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { formatCalendarDate } from '@/lib/format';
import { useUpdateMeeting } from './hooks';

export function MeetingResults({ meetings }: { meetings: MeetingListItem[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {meetings.map((meeting) => (
        <ProjectMeetingCard key={meeting.id} meeting={meeting} />
      ))}
    </ul>
  );
}

function ProjectMeetingCard({ meeting }: { meeting: MeetingListItem }) {
  const update = useUpdateMeeting(meeting.id);
  return (
    <li className="rounded-card border border-white/70 glass p-4 shadow-card">
      <h3 className="truncate text-base font-semibold" title={meeting.title}>
        {meeting.title}
      </h3>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
        <CalendarDays aria-hidden="true" className="size-4" />
        {formatCalendarDate(meeting.meetingDate)}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          to={`/meetings/${meeting.id}`}
          variant="secondary"
          size="sm"
          icon={<ArrowUpRight aria-hidden="true" className="size-4" />}
        >
          Open meeting
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<FolderMinus aria-hidden="true" className="size-4" />}
          loading={update.isPending}
          onClick={() => update.mutate({ projectId: null })}
        >
          Remove from project
        </Button>
      </div>
      {update.error && (
        <Alert tone="danger" className="mt-3 text-sm">
          {update.error.message}
        </Alert>
      )}
    </li>
  );
}
