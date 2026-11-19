import type { ActionItem, Decision, Meeting } from '@debrief/shared';
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Textarea } from '@/components/ui/Input';
import { ActionItemCard, LineLink } from '@/features/actionItems/ActionItemCard';
import { ActionItemDialog } from '@/features/actionItems/ActionItemDialog';
import { DeleteActionItemDialog } from '@/features/actionItems/DeleteActionItemDialog';
import {
  useCreateDecision,
  useDeleteDecision,
  useUpdateDecision,
} from '@/features/actionItems/hooks';
import { AnalysisStatusBadge } from './AnalysisStatusBadge';
import { useAnalyzeMeeting, useUpdateMeeting } from './hooks';

/**
 * The meeting's results, all editable: the AI's draft is a starting point the user corrects.
 * The saved analysis stays visible while a re-run is in progress, so notes never disappear.
 */
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
  const hasResults =
    meeting.summary !== null || meeting.decisions.length > 0 || meeting.actionItems.length > 0;
  const analysed = meeting.summary !== null;

  const start = () => analyze.mutate(undefined, { onSuccess: () => setConfirmOpen(false) });

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

      {hasResults || !running ? (
        <div className="mt-8 space-y-8">
          {meeting.summary !== null && <SummarySection meeting={meeting} />}
          <DecisionsSection meeting={meeting} onSourceJump={onSourceJump} />
          <ActionItemsSection meeting={meeting} onSourceJump={onSourceJump} />
        </div>
      ) : null}

      {!running && (
        <Button
          className="mt-8"
          variant="secondary"
          icon={<RotateCcw aria-hidden="true" className="size-4" />}
          loading={analyze.isPending}
          onClick={() => (analysed ? setConfirmOpen(true) : start())}
        >
          {analysed ? 'Re-analyse' : 'Retry analysis'}
        </Button>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => !analyze.isPending && setConfirmOpen(false)}
        title="Re-analyse this meeting?"
        description="The new analysis will replace the AI-generated decisions and action items, including any edits you made to them. Items you added yourself will stay."
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

// ---------------------------------------------------------------------------------------------

function SectionHeader({
  id,
  title,
  count,
  action,
}: {
  id: string;
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 id={id} className="text-lg font-bold">
        {title}
        {count !== undefined && (
          <span className="ml-2 text-sm font-normal tabular-nums text-muted">{count}</span>
        )}
      </h3>
      {action}
    </div>
  );
}

function SummarySection({ meeting }: { meeting: Meeting }) {
  const update = useUpdateMeeting(meeting.id);
  const [draft, setDraft] = useState<string | null>(null); // null = not editing

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (draft === null) return;
    update.mutate({ summary: draft }, { onSuccess: () => setDraft(null) });
  };

  return (
    <section aria-labelledby="summary-heading">
      <SectionHeader
        id="summary-heading"
        title="Summary"
        action={
          draft === null && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Pencil aria-hidden="true" className="size-4" />}
              onClick={() => setDraft(meeting.summary ?? '')}
              // An explicit label: a visually hidden " summary" span gets its space trimmed by
              // some accessible-name calculations, which reads as "Editsummary".
              aria-label="Edit summary"
            >
              Edit
            </Button>
          )
        }
      />
      {draft === null ? (
        <p className="mt-3 border-l-2 border-accent pl-4 text-base leading-7 whitespace-pre-wrap">
          {meeting.summary}
        </p>
      ) : (
        <form onSubmit={save} className="mt-3 space-y-3">
          <Textarea
            aria-label="Summary text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={5}
            autoFocus
          />
          {update.error && <Alert tone="danger">{update.error.message}</Alert>}
          <InlineFormButtons saving={update.isPending} onCancel={() => setDraft(null)} />
        </form>
      )}
    </section>
  );
}

function DecisionsSection({
  meeting,
  onSourceJump,
}: {
  meeting: Meeting;
  onSourceJump?: () => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <section aria-labelledby="decisions-heading" className="border-t border-line pt-6">
      <SectionHeader
        id="decisions-heading"
        title="Decisions"
        count={meeting.decisions.length}
        action={
          !adding && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus aria-hidden="true" className="size-4" />}
              onClick={() => setAdding(true)}
            >
              Add decision
            </Button>
          )
        }
      />
      {meeting.decisions.length > 0 ? (
        <ol className="mt-3 space-y-3">
          {meeting.decisions.map((decision) => (
            <li key={decision.id}>
              <DecisionRow meetingId={meeting.id} decision={decision} onSourceJump={onSourceJump} />
            </li>
          ))}
        </ol>
      ) : (
        !adding && <p className="mt-2 text-sm text-muted">No decisions were recorded.</p>
      )}
      {adding && <NewDecisionForm meetingId={meeting.id} onDone={() => setAdding(false)} />}
    </section>
  );
}

function DecisionRow({
  meetingId,
  decision,
  onSourceJump,
}: {
  meetingId: string;
  decision: Decision;
  onSourceJump?: () => void;
}) {
  const update = useUpdateDecision(meetingId);
  const remove = useDeleteDecision(meetingId);
  const [draft, setDraft] = useState<string | null>(null);

  if (draft !== null) {
    return (
      <form
        className="space-y-3 rounded-md bg-surface-2 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          update.mutate({ id: decision.id, text: draft }, { onSuccess: () => setDraft(null) });
        }}
      >
        <Input
          aria-label="Decision"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoFocus
        />
        {update.error && <Alert tone="danger">{update.error.message}</Alert>}
        <InlineFormButtons saving={update.isPending} onCancel={() => setDraft(null)} />
      </form>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-md bg-surface-2 p-4 text-sm">
      <div className="min-w-0 flex-1">
        <p>{decision.text}</p>
        <LineLink line={decision.sourceLine} onJump={onSourceJump} />
        {remove.error && (
          <p role="alert" className="mt-1 text-danger">
            Couldn’t delete: {remove.error.message}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <SmallIconButton
          label={`Edit decision “${decision.text}”`}
          onClick={() => setDraft(decision.text)}
        >
          <Pencil aria-hidden="true" className="size-4" />
        </SmallIconButton>
        <SmallIconButton
          label={`Delete decision “${decision.text}”`}
          disabled={remove.isPending}
          onClick={() => remove.mutate(decision.id)}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </SmallIconButton>
      </div>
    </div>
  );
}

function NewDecisionForm({ meetingId, onDone }: { meetingId: string; onDone: () => void }) {
  const create = useCreateDecision(meetingId);
  const [text, setText] = useState('');
  return (
    <form
      className="mt-3 space-y-3 rounded-md border border-line p-4"
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
      <InlineFormButtons saving={create.isPending} onCancel={onDone} saveLabel="Add decision" />
    </form>
  );
}

function ActionItemsSection({
  meeting,
  onSourceJump,
}: {
  meeting: Meeting;
  onSourceJump?: () => void;
}) {
  const [dialog, setDialog] = useState<{ item?: ActionItem } | null>(null);
  const [deleting, setDeleting] = useState<ActionItem | null>(null);

  // Owner suggestions: everyone who spoke, plus anyone already named as an owner.
  const ownerSuggestions = useMemo(() => {
    const names = [
      ...meeting.transcriptLines.map((line) => line.speaker),
      ...meeting.actionItems.map((item) => item.owner),
    ].filter((name): name is string => Boolean(name));
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [meeting.transcriptLines, meeting.actionItems]);

  const done = meeting.actionItems.filter((i) => i.status === 'done').length;
  const flagged = meeting.actionItems.filter((i) => i.needsReview).length;

  return (
    <section aria-labelledby="items-heading" className="border-t border-line pt-6">
      <SectionHeader
        id="items-heading"
        title="Action items"
        count={meeting.actionItems.length}
        action={
          <Button
            variant="ghost"
            size="sm"
            icon={<Plus aria-hidden="true" className="size-4" />}
            onClick={() => setDialog({})}
          >
            Add action item
          </Button>
        }
      />
      {meeting.actionItems.length > 0 && (
        <p className="mt-1 text-sm text-muted">
          {done} of {meeting.actionItems.length} done
          {flagged > 0 && ` · ${flagged} need${flagged === 1 ? 's' : ''} review`}
        </p>
      )}
      {meeting.actionItems.length > 0 ? (
        <ol className="mt-3 space-y-3">
          {meeting.actionItems.map((item) => (
            <li key={item.id}>
              <ActionItemCard
                item={item}
                onEdit={() => setDialog({ item })}
                onDelete={() => setDeleting(item)}
                source={
                  item.sourceQuote || item.sourceLine ? (
                    <p className="text-muted">
                      {item.sourceQuote && <>“{item.sourceQuote}” </>}
                      <LineLink line={item.sourceLine} onJump={onSourceJump} />
                    </p>
                  ) : item.origin === 'manual' ? (
                    <p className="text-muted">Added by you</p>
                  ) : null
                }
              />
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-muted">No action items were found.</p>
      )}

      <ActionItemDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        meetingId={meeting.id}
        item={dialog?.item}
        ownerSuggestions={ownerSuggestions}
      />
      <DeleteActionItemDialog item={deleting} onClose={() => setDeleting(null)} />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------

function InlineFormButtons({
  saving,
  onCancel,
  saveLabel = 'Save',
}: {
  saving: boolean;
  onCancel: () => void;
  saveLabel?: string;
}) {
  return (
    <div className="flex gap-2">
      <Button type="submit" size="sm" loading={saving}>
        {saveLabel}
      </Button>
      <Button size="sm" variant="secondary" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
    </div>
  );
}

function SmallIconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-9 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface hover:text-fg disabled:opacity-50"
    >
      {children}
    </button>
  );
}
