import type { Meeting } from '@debrief/shared';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { formatCalendarDate } from '@/lib/format';
import { AnalysisStatusBadge } from './AnalysisStatusBadge';
import { useAnalyzeMeeting } from './hooks';

function LineLink({ line, onJump }: { line: number | null; onJump?: () => void }) {
  return line === null ? null : (
    <Link
      className="text-sm font-semibold text-accent hover:underline"
      to={`#L${line}`}
      onClick={onJump}
    >
      Line {line}
    </Link>
  );
}

/** Shows the saved analysis while a re-run is in progress, so useful notes never disappear. */
export function AnalysisPanel({
  meeting,
  onSourceJump,
}: {
  meeting: Meeting;
  onSourceJump?: () => void;
}) {
  const analyze = useAnalyzeMeeting(meeting.id);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const running = meeting.analysisStatus === 'pending' || meeting.analysisStatus === 'processing';
  const hasResults = meeting.summary !== null;

  const start = () => {
    analyze.mutate(undefined, { onSuccess: () => setConfirmOpen(false) });
  };

  return (
    <Card className="overflow-hidden p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow text-accent">Meeting intelligence</p>
          <h2 className="mt-1 text-xl font-bold">Analysis</h2>
        </div>
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
        <div className="mt-8 space-y-8">
          <section aria-labelledby="summary-heading">
            <h3 id="summary-heading" className="text-lg font-bold">
              Summary
            </h3>
            <p className="mt-3 border-l-2 border-accent pl-4 text-base leading-7 whitespace-pre-wrap">
              {meeting.summary}
            </p>
          </section>

          <section aria-labelledby="decisions-heading" className="border-t border-line pt-6">
            <div className="flex items-baseline justify-between gap-3">
              <h3 id="decisions-heading" className="text-lg font-bold">
                Decisions
              </h3>
              <span className="text-sm tabular-nums text-muted">{meeting.decisions.length}</span>
            </div>
            {meeting.decisions.length ? (
              <ol className="mt-3 space-y-3">
                {meeting.decisions.map((decision) => (
                  <li key={decision.id} className="rounded-md bg-surface-2 p-4 text-sm">
                    <p>{decision.text}</p>
                    <LineLink line={decision.sourceLine} onJump={onSourceJump} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted">No decisions were recorded.</p>
            )}
          </section>

          <section aria-labelledby="items-heading" className="border-t border-line pt-6">
            <div className="flex items-baseline justify-between gap-3">
              <h3 id="items-heading" className="text-lg font-bold">
                Action items
              </h3>
              <span className="text-sm tabular-nums text-muted">{meeting.actionItems.length}</span>
            </div>
            {meeting.actionItems.length ? (
              <ol className="mt-3 space-y-3">
                {meeting.actionItems.map((item) => (
                  <li key={item.id} className="rounded-md border border-line p-4 text-sm">
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
                    <LineLink line={item.sourceLine} onJump={onSourceJump} />
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
