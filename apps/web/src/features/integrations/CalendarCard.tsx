// The Google Calendar section on the account page.
import { CalendarCheck, CalendarDays } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/lib/format';
import { CONNECT_CALENDAR_URL, useCalendarStatus, useDisconnectCalendar } from './hooks';

const RESULTS = {
  connected: { tone: 'success', text: 'Google Calendar is connected.' },
  denied: { tone: 'info', text: 'Connecting was cancelled. Nothing was changed.' },
  error: { tone: 'danger', text: 'Couldn’t connect Google Calendar. Please try again.' },
  unavailable: { tone: 'warning', text: 'Google Calendar isn’t set up on this server yet.' },
} as const;

export function CalendarCard({ result }: { result: string | null }) {
  const { data: status, isPending, error } = useCalendarStatus();
  const disconnect = useDisconnectCalendar();
  const message = result && result in RESULTS ? RESULTS[result as keyof typeof RESULTS] : null;

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-soft text-accent"
        >
          {status?.connected ? (
            <CalendarCheck className="size-5" />
          ) : (
            <CalendarDays className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">Google Calendar</h2>
          <p className="mt-1 text-sm text-muted">
            Add action items with a due date to your calendar as all-day events. Debrief asks only
            for permission to manage calendar events (never your email or contacts) and only creates
            or updates events for your action items.
          </p>

          {message && (
            <Alert tone={message.tone} className="mt-4">
              {message.text}
            </Alert>
          )}
          {disconnect.error && (
            <Alert tone="danger" className="mt-4">
              {disconnect.error.message}
            </Alert>
          )}

          <div className="mt-5">
            {isPending ? (
              <Skeleton className="h-11 w-48" />
            ) : error ? (
              <p className="text-sm text-danger">Couldn’t check the connection: {error.message}</p>
            ) : !status.available ? (
              <p className="text-sm text-muted">Not available on this server.</p>
            ) : status.connected ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold text-success">
                  Connected
                  {status.connectedAt && (
                    <span className="font-normal text-muted">
                      {' '}
                      since {formatDate(status.connectedAt)}
                    </span>
                  )}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={disconnect.isPending}
                  onClick={() => disconnect.mutate()}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <a
                href={CONNECT_CALENDAR_URL}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover"
              >
                <CalendarDays aria-hidden="true" className="size-4" />
                Connect Google Calendar
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
