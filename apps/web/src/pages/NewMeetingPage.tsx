import { ArrowLeft, Upload } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

// Placeholder until Phase 2 builds paste/upload here.
export function NewMeetingPage() {
  return (
    <>
      <PageHeader title="New meeting" description="Add a transcript to analyse." />
      <EmptyState
        icon={<Upload />}
        title="Transcript upload is coming next"
        description="Soon you'll paste a transcript or drop a .txt, .vtt or .md file here."
        action={
          <Button
            to="/meetings"
            variant="secondary"
            icon={<ArrowLeft aria-hidden="true" className="size-4" />}
          >
            Back to meetings
          </Button>
        }
      />
    </>
  );
}
