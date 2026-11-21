// A simple list of meetings, used on the projects page.
import type { MeetingListItem } from '@debrief/shared';
import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router';
import { MeetingMenu } from './MeetingMenu';

export function MeetingResults({ meetings }: { meetings: MeetingListItem[] }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-white/70 glass shadow-card">
      {meetings.map((meeting) => (
        <li key={meeting.id} className="flex items-center gap-2 px-4 py-3 hover:bg-surface-2">
          <Link to={`/meetings/${meeting.id}`} className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{meeting.title}</span>
            <span className="mt-1 flex items-center gap-1 text-sm text-muted">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {meeting.meetingDate}
            </span>
          </Link>
          <div className="rounded-md bg-sidebar text-sidebar-fg">
            <MeetingMenu meeting={meeting} />
          </div>
        </li>
      ))}
    </ul>
  );
}
