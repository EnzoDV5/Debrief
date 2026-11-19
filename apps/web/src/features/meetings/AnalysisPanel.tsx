import type { Meeting } from '@debrief/shared';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { formatCalendarDate } from '@/lib/format';
import { AnalysisStatusBadge } from './AnalysisStatusBadge';
import { useAnalyzeMeeting } from './hooks';

function LineLink({ line }: { line: number | null }) {
  return line === null ? null : (
    <a className="text-sm font-semibold text-accent hover:underline" href={`#L${line}`}>
      Line {line}
    </a>
  );
}

/** Shows the saved analysis while a re-run is in progress, so useful notes never disappear. */
export function AnalysisPanel({ meeting }: { meeting: Meeting }) {
  const analyze = useAnalyzeMeeting(meeting.id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const running = meeting.analysisStatus === 'pending' || meeting.analysisStatus === 'processing';
  const hasResults = meeting.summary !== null;

  const start = () => {
    analyze.mutate(undefined, { onSuccess: () => setConfirmOpen(false) });
  };

  return (
    <Card className="p-5 sm:p-6 lg:sticky lg:top-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Analysis</h2>
        <AnalysisStatusBadge status={meeting.analysisStatus} />
      </div>

      {running && (
        <Alert className="mt-5">
          {meeting.analysisStatus === 'pending'
            ? 'Your transcript is saved. Analysis will start shortly.'
            : 'Reading the transcript now. This page updates automatically.'}
        </Alert>
      )}
      {meeting.analysisStatus === 'failed' && (
        <Alert tone="danger" className="mt-5">
          {meeting.analysisError ?? 'Analysis failed. Please try again.'}
        </Alert>
      )}
      {analyze.error && (
        <Alert tone="danger" className="mt-5">
          {analyze.error.message}
        </Alert>
      )}

      {hasResults ? (
        <div className="mt-6 space-y-7">
          <section aria-labelledby="summary-heading">
            <h3 id="summary-heading" className="font-bold">
              Summary
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{meeting.summary}</p>
          </section>

          <section aria-labelledby="decisions-heading">
            <h3 id="decisions-heading" className="font-bold">
              Decisions
            </h3>
            {meeting.decisions.length ? (
              <ol className="mt-3 space-y-3">
                {meeting.decisions.map((decision) => (
                  <li key={decision.id} className="rounded-md bg-surface-2 p-3 text-sm">
                    <p>{decision.text}</p>
                    <LineLink line={decision.sourceLine} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted">No decisions were recorded.</p>
            )}
          </section>

          <section aria-labelledby="items-heading">
            <h3 id="items-heading" className="font-bold">
              Action items
            </h3>
            {meeting.actionItems.length ? (
              <ol className="mt-3 space-y-3">
                {meeting.actionItems.map((item) => (
                  <li key={item.id} className="rounded-md border border-line p-3 text-sm">
                    <p className="font-semibold">{item.text}</p>
                    <p className="mt-1 text-muted">
                      {item.owner ?? 'No owner named'}
                      {' · '}
                      {item.dueDate
                        ? formatCalendarDate(item.dueDate)
                        : (item.dueDateText ?? 'No due date')}
                    </p>
                    {item.needsReview && (
                      <p className="mt-2 text-warning">
                        <strong>Needs review:</strong> {item.reviewReason ?? 'Check this item'}
                      </p>
                    )}
                    {item.sourceQuote && <p className="mt-2 text-muted">“{item.sourceQuote}”</p>}
                    <LineLink line={item.sourceLine} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted">No action items were found.</p>
            )}
          </section>
        </div>
      ) : !running && meeting.analysisStatus !== 'failed' ? (
        <p className="mt-5 text-sm text-muted">No analysis yet.</p>
      ) : null}

      {!running && (
        <Button
          className="mt-6"
          variant="secondary"
          icon={<RotateCcw aria-hidden="true" className="size-4" />}
          loading={analyze.isPending}
          onClick={() => (hasResults ? setConfirmOpen(true) : start())}
        >
          {hasResults ? 'Re-analyse' : 'Retry analysis'}
        </Button>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => !analyze.isPending && setConfirmOpen(false)}
        title="Re-analyse this meeting?"
        description="The new analysis will replace the AI-generated decisions and action items. Items you added yourself will stay."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            disabled={analyze.isPending}
            onClick={() => setConfirmOpen(false)}
          >
            Cancel
          </Button>
          <Button loading={analyze.isPending} onClick={start}>
            Re-analyse
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
