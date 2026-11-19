import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { NewMeetingForm } from '@/features/meetings/NewMeetingForm';

export function NewMeetingPage() {
  return (
    <>
      <BackLink />
      <PageHeader
        title="New meeting"
        description="Paste a transcript or upload a file. It's saved straight away, so nothing is lost."
      />
      <NewMeetingForm />
    </>
  );
}

export function BackLink() {
  return (
    <Link
      to="/meetings"
      className="mb-4 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      All meetings
    </Link>
  );
}
