import { FileText, Plus } from 'lucide-react';
import { useLocation } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { useCurrentUser } from '@/features/auth/hooks';
import { usePageTitle } from '@/lib/usePageTitle';

type LocationState = { welcome?: boolean; deleted?: string } | null;

/** A quiet starting point. The sidebar owns meeting history, so it is not repeated here. */
export function MeetingsPage() {
  usePageTitle('Workspace');
  const user = useCurrentUser();
  const state = useLocation().state as LocationState;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-2xl flex-col justify-center pb-16">
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

      <div className="text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-6 grid size-16 place-items-center rounded-card bg-accent-soft text-accent"
        >
          <FileText className="size-8" />
        </div>
        <p className="eyebrow text-accent">Your workspace</p>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">What would you like to debrief?</h1>
        <p className="mx-auto mt-4 max-w-lg text-base text-muted">
          Paste a meeting transcript or upload a file. Debrief will pull out the summary, decisions
          and action items. Your previous meetings are in the sidebar.
        </p>
        <Button
          to="/meetings/new"
          className="mt-7"
          icon={<Plus aria-hidden="true" className="size-4" />}
        >
          New meeting
        </Button>
        <p className="mt-6 text-sm text-muted lg:hidden">
          Use the menu above to open your meeting history.
        </p>
      </div>
    </div>
  );
}
