import type { ActionItem } from '@debrief/shared';
import { CalendarCheck, CalendarPlus, ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useAddToCalendar, useCalendarStatus } from './hooks';

/**
 * "Add to calendar" on an action item. Shown only when it can work: the item has a due date and
 * the user has connected Google Calendar. Adding again updates the same event.
 */
export function AddToCalendar({ item }: { item: ActionItem }) {
  const { data: status } = useCalendarStatus();
  const add = useAddToCalendar();

  if (!item.dueDate || !status?.available) return null;
  // Has a date, calendar not linked yet: show the way to it instead of hiding the feature.
  if (!status.connected) {
    return (
      <Link
        to="/account"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
      >
        <CalendarPlus aria-hidden="true" className="size-4" />
        Connect Google Calendar to add this
      </Link>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <Button
        // A light, secondary action on the card: ghost, pulled left so its icon lines up with
        // the text above.
        variant="ghost"
        size="sm"
        className="-ml-2.5"
        loading={add.isPending}
        icon={
          item.inCalendar ? (
            <CalendarCheck aria-hidden="true" className="size-4" />
          ) : (
            <CalendarPlus aria-hidden="true" className="size-4" />
          )
        }
        onClick={() => add.mutate(item.id)}
        aria-label={`${item.inCalendar ? 'Update' : 'Add'} “${item.text}” in Google Calendar`}
      >
        {item.inCalendar ? 'Update calendar event' : 'Add to calendar'}
      </Button>

      {add.data && (
        <a
          href={add.data.eventUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
        >
          Open in Google Calendar
          <ExternalLink aria-hidden="true" className="size-3.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
      {add.error && (
        <p role="alert" className="w-full text-danger">
          {add.error.message}{' '}
          {'code' in add.error && add.error.code === 'CALENDAR_RECONNECT' && (
            <Link to="/account" className="font-semibold underline">
              Reconnect
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
