import type { Meeting } from '@debrief/shared';
import { Pencil, RotateCcw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Input';
import { AnalysisStatusBadge } from '../AnalysisStatusBadge';
import { useAnalyzeMeeting, useUpdateMeeting } from '../hooks';
/** The meeting summary spans the page above the annotated transcript. */
export function MeetingOverview({ meeting }: { meeting: Meeting }) {
  const analyze = useAnalyzeMeeting(meeting.id);
  const [confirmRerun, setConfirmRerun] = useState(false);

  const running = meeting.analysisStatus === 'pending' || meeting.analysisStatus === 'processing';
  const analysed = meeting.summary !== null;
  const rerun = () => analyze.mutate(undefined, { onSuccess: () => setConfirmRerun(false) });

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="eyebrow text-accent">Summary</h2>
        <div className="flex flex-wrap items-center gap-2">
          <AnalysisStatusBadge status={meeting.analysisStatus} />
          {analysed && !running && (
            <Button
              size="sm"
              variant="ghost"
              icon={<RotateCcw aria-hidden="true" className="size-4" />}
              onClick={() => setConfirmRerun(true)}
            >
              Re-analyse
            </Button>
          )}
        </div>
      </div>

      {running && (
        <Alert className="mt-4">
          {meeting.analysisStatus === 'pending'
            ? 'Your transcript is saved. The AI will start reading it in a moment.'
            : 'The AI is reading the transcript. Results appear here and beside the text when it’s done.'}
        </Alert>
      )}
      {meeting.analysisStatus === 'failed' && (
        <Alert tone="danger" className="mt-4">
          <p>{meeting.analysisError ?? 'Analysis failed. Your transcript is saved.'}</p>
          <Button size="sm" className="mt-3" loading={analyze.isPending} onClick={rerun}>
            Retry analysis
          </Button>
        </Alert>
      )}
      {analyze.error && (
        <Alert tone="danger" className="mt-4">
          {analyze.error.message}
        </Alert>
      )}

      {analysed ? (
        <Summary meeting={meeting} />
      ) : (
        !running && (
          <p className="mt-3 text-muted">
            The summary appears here once the AI has read the transcript.
          </p>
        )
      )}

      <Dialog
        open={confirmRerun}
        onClose={() => !analyze.isPending && setConfirmRerun(false)}
        title="Re-analyse this meeting?"
        description="The new analysis replaces the AI’s decisions and action items, including edits you made to them. Items you added yourself stay."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            disabled={analyze.isPending}
            onClick={() => setConfirmRerun(false)}
          >
            Cancel
          </Button>
          <Button loading={analyze.isPending} onClick={rerun}>
            Re-analyse
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}

function Summary({ meeting }: { meeting: Meeting }) {
  const update = useUpdateMeeting(meeting.id);
  const [draft, setDraft] = useState<string | null>(null); // null = not editing

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (draft !== null) update.mutate({ summary: draft }, { onSuccess: () => setDraft(null) });
  };

  if (draft !== null) {
    return (
      <form onSubmit={save} className="mt-3 space-y-3">
        <Textarea
          aria-label="Summary text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={5}
          autoFocus
        />
        {update.error && <Alert tone="danger">{update.error.message}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" loading={update.isPending}>
            Save
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setDraft(null)}
            disabled={update.isPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-3 flex items-start gap-3">
      <p className="flex-1 text-base leading-7 whitespace-pre-wrap">{meeting.summary}</p>
      <Button
        variant="ghost"
        size="sm"
        icon={<Pencil aria-hidden="true" className="size-4" />}
        onClick={() => setDraft(meeting.summary ?? '')}
        // Explicit label: a visually hidden " summary" span can lose its space ("Editsummary").
        aria-label="Edit summary"
      >
        Edit
      </Button>
    </div>
  );
}
