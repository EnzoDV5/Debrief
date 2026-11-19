import { FileText, Plus } from 'lucide-react';
import { useLocation } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCurrentUser } from '@/features/auth/hooks';

// Phase 1: the list is always empty. Phase 2 adds the real meetings query here, plus a
// "New meeting" header action once there's a list to put it above. While the list is empty,
// the empty state's button is the one clear call to action (no duplicate buttons).
export function MeetingsPage() {
  const user = useCurrentUser();
  const justRegistered = (useLocation().state as { welcome?: boolean } | null)?.welcome;
  const firstName = user.name.split(' ')[0];

  return (
    <>
      <PageHeader title="Meetings" description="Every transcript you've added, newest first." />

      {justRegistered && (
        <Alert tone="success" title={`Welcome to Debrief, ${firstName}!`} className="mb-6">
          Add your first meeting to get its summary, decisions and action items.
        </Alert>
      )}

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
    </>
  );
}
