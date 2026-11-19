import type { Meeting } from '@debrief/shared';
import { Pencil, Plus, RotateCcw } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Textarea } from '@/components/ui/Input';
import { ActionItemDialog } from '@/features/actionItems/ActionItemDialog';
import { useCreateDecision } from '@/features/actionItems/hooks';
import { plural } from '@/lib/format';
import { AnalysisStatusBadge } from '../AnalysisStatusBadge';
import { useAnalyzeMeeting, useUpdateMeeting } from '../hooks';
import { DecisionBubble } from './DecisionBubble';

/**
 * The top of a meeting: where the analysis is up to, the (editable) summary, the counts, and
 * the actions that add to the document below.
 */
export function MeetingOverview({ meeting }: { meeting: Meeting }) {
  const analyze = useAnalyzeMeeting(meeting.id);
  const [confirmRerun, setConfirmRerun] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [addingDecision, setAddingDecision] = useState(false);

  const running = meeting.analysisStatus === 'pending' || meeting.analysisStatus === 'processing';
  const analysed = meeting.summary !== null;
  const items = meeting.actionItems;
  const flagged = items.filter((i) => i.needsReview).length;
  const done = items.filter((i) => i.status === 'done').length;

  const ownerSuggestions = useMemo(
    () =>
      [
        ...new Set(meeting.transcriptLines.map((l) => l.speaker).filter(Boolean) as string[]),
      ].sort(),
    [meeting.transcriptLines],
  );

  const rerun = () => analyze.mutate(undefined, { onSuccess: () => setConfirmRerun(false) });

  return (
    <Card className="p-5 sm:p-6 xl:max-h-[calc(100dvh-3rem)] xl:overflow-y-auto">
      <div className="flex items-center justify-between gap-3">
        <h2 className="eyebrow text-accent">Summary</h2>
        <AnalysisStatusBadge status={meeting.analysisStatus} />
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

      <div className="mt-5 flex flex-col gap-4 border-t border-line pt-4">
        <ul aria-label="Counts" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <li>
            <Dot className="bg-accent" /> <strong>{plural(items.length, 'action item')}</strong>
            {items.length > 0 && <span className="text-muted"> · {done} done</span>}
          </li>
          {flagged > 0 && (
            <li className="text-warning">
              <Dot className="bg-warning" /> <strong>{flagged}</strong> need
              {flagged === 1 ? 's' : ''} review
            </li>
          )}
          <li>
            <Dot className="bg-success" />{' '}
            <strong>{plural(meeting.decisions.length, 'decision')}</strong>
          </li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus aria-hidden="true" className="size-4" />}
            onClick={() => setAddingItem(true)}
          >
            Add action item
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus aria-hidden="true" className="size-4" />}
            onClick={() => setAddingDecision(true)}
          >
            Add decision
          </Button>
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

      {meeting.decisions.length > 0 && (
        <section className="mt-5 border-t border-line pt-4" aria-label="Decisions">
          <h3 className="eyebrow text-success">Decisions</h3>
          <ul className="mt-3 space-y-3 text-sm">
            {meeting.decisions.map((decision) => (
              <li key={decision.id}>
                <DecisionBubble meetingId={meeting.id} decision={decision} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {addingDecision && (
        <NewDecisionForm meetingId={meeting.id} onDone={() => setAddingDecision(false)} />
      )}

      <ActionItemDialog
        open={addingItem}
        onClose={() => setAddingItem(false)}
        meetingId={meeting.id}
        ownerSuggestions={ownerSuggestions}
      />
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

function Dot({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 rounded-pill align-middle ${className}`}
    />
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

function NewDecisionForm({ meetingId, onDone }: { meetingId: string; onDone: () => void }) {
  const create = useCreateDecision(meetingId);
  const [text, setText] = useState('');
  return (
    <form
      className="mt-4 space-y-3 rounded-md border border-line p-4"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate({ text }, { onSuccess: onDone });
      }}
    >
      <Input
        aria-label="New decision"
        placeholder="e.g. Launch the three-tier pricing page"
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoFocus
      />
      {create.error && <Alert tone="danger">{create.error.message}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={create.isPending}>
          Add decision
        </Button>
        <Button size="sm" variant="secondary" onClick={onDone} disabled={create.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
