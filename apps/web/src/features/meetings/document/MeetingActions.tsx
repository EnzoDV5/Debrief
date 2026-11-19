import type { ActionItem, Meeting } from '@debrief/shared';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ActionItemCard, LineLink } from '@/features/actionItems/ActionItemCard';
import { ActionItemDialog } from '@/features/actionItems/ActionItemDialog';
import { DeleteActionItemDialog } from '@/features/actionItems/DeleteActionItemDialog';
import { plural } from '@/lib/format';

/** The right rail keeps tasks visible while the original conversation is read. */
export function MeetingActions({
  meeting,
  activeId,
  onActiveChange,
}: {
  meeting: Meeting;
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ActionItem | null>(null);
  const [deleting, setDeleting] = useState<ActionItem | null>(null);
  const items = meeting.actionItems;
  const done = items.filter((item) => item.status === 'done').length;
  const needsReview = items.filter((item) => item.needsReview).length;
  const ownerSuggestions = useMemo(
    () =>
      [
        ...new Set(
          [
            ...meeting.transcriptLines.map((line) => line.speaker),
            ...items.map((item) => item.owner),
          ].filter((name): name is string => Boolean(name)),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [meeting.transcriptLines, items],
  );

  return (
    <section aria-labelledby="meeting-actions-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <h2 id="meeting-actions-title" className="text-lg font-bold">
            Action items
          </h2>
          <ul aria-label="Counts" className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
            <li>{plural(items.length, 'action item')}</li>
            {items.length > 0 && <li>{done} done</li>}
            {needsReview > 0 && <li className="text-warning">{needsReview} needs review</li>}
          </ul>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={<Plus aria-hidden="true" className="size-4" />}
          onClick={() => setAdding(true)}
        >
          Add action item
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="mt-5 rounded-md border border-dashed border-line p-4 text-sm text-muted">
          No action items yet. Add one, or wait for the analysis to finish.
        </p>
      ) : (
        <ol className="mt-4 space-y-4">
          {items.map((item) => (
            <li key={item.id}>
              <ActionItemCard
                item={item}
                active={activeId === item.id}
                onActiveChange={(active) => onActiveChange(active ? item.id : null)}
                onEdit={() => setEditing(item)}
                onDelete={() => setDeleting(item)}
                source={<ActionContext meeting={meeting} item={item} />}
              />
            </li>
          ))}
        </ol>
      )}

      <ActionItemDialog
        open={adding}
        onClose={() => setAdding(false)}
        meetingId={meeting.id}
        ownerSuggestions={ownerSuggestions}
      />
      {editing && (
        <ActionItemDialog
          open
          onClose={() => setEditing(null)}
          meetingId={meeting.id}
          item={editing}
          ownerSuggestions={ownerSuggestions}
        />
      )}
      <DeleteActionItemDialog item={deleting} onClose={() => setDeleting(null)} />
    </section>
  );
}

/** Keep the context tied to saved transcript words rather than inventing a paraphrase. */
function ActionContext({ meeting, item }: { meeting: Meeting; item: ActionItem }) {
  const line = meeting.transcriptLines.find((entry) => entry.n === item.sourceLine);
  if (!line)
    return (
      <div className="text-xs text-muted">
        <p>{item.origin === 'manual' ? 'Added by you' : 'Source needs review'}</p>
        <p>No verified transcript line linked.</p>
      </div>
    );
  return (
    <div className="rounded-md bg-surface-2/70 p-3 text-xs leading-5 text-muted">
      <p className="font-semibold text-fg">What was said</p>
      <p className="mt-1 line-clamp-3">
        {line.speaker ? `${line.speaker}: ` : ''}“{line.text.trim()}”
      </p>
      <p className="mt-2">
        <LineLink meetingId={meeting.id} line={line.n} />
      </p>
    </div>
  );
}
