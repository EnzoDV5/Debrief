import { useLocation } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { useCurrentUser } from '@/features/auth/hooks';
import { NewMeetingFlow } from '@/features/meetings/NewMeetingFlow';
import { usePageTitle } from '@/lib/usePageTitle';

type LocationState = { welcome?: boolean; deleted?: string } | null;

/**
 * Home: the drop zone IS the start screen (one obvious thing to do). Past meetings live in the
 * sidebar; action items across meetings have their own page.
 */
export function MeetingsPage() {
  usePageTitle('New meeting');
  const user = useCurrentUser();
  const state = useLocation().state as LocationState;

  return (
    <NewMeetingFlow
      notice={
        <>
          {state?.welcome && (
            <Alert
              tone="success"
              title={`Welcome to Debrief, ${user.name.split(' ')[0]}!`}
              className="mx-auto mb-2 max-w-2xl"
            >
              Drop in your first meeting transcript to get its summary, decisions and action items.
            </Alert>
          )}
          {state?.deleted && (
            <Alert tone="success" className="mx-auto mb-2 max-w-2xl">
              Deleted &ldquo;{state.deleted}&rdquo;.
            </Alert>
          )}
        </>
      }
    />
  );
}
