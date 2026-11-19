import type { ActionItem, Meeting } from '@debrief/shared';
import { useState } from 'react';
import { ActionItemCard } from '@/features/actionItems/ActionItemCard';
import { ActionItemDialog } from '@/features/actionItems/ActionItemDialog';
import { DeleteActionItemDialog } from '@/features/actionItems/DeleteActionItemDialog';

/** An action and its source context, rendered beside its transcript line. */
export function MeetingActionCard({
  meeting,
  item,
  ownerSuggestions,
  active,
  onActiveChange,
}: {
  meeting: Meeting;
  item: ActionItem;
  ownerSuggestions: string[];
  active: boolean;
  onActiveChange: (active: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <ActionItemCard
        item={item}
        active={active}
        onActiveChange={onActiveChange}
        onEdit={() => setEditing(true)}
        onDelete={() => setDeleting(true)}
        source={<ActionContext meeting={meeting} item={item} />}
      />
      <ActionItemDialog
        open={editing}
        onClose={() => setEditing(false)}
        meetingId={meeting.id}
        item={item}
        ownerSuggestions={ownerSuggestions}
      />
      <DeleteActionItemDialog item={deleting ? item : null} onClose={() => setDeleting(false)} />
    </>
  );
}

/** Keep context tied to saved transcript words rather than inventing a paraphrase. */
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
    <div className="rounded-md bg-surface-2/70 px-3 py-2 text-xs leading-5 text-muted">
      <p className="line-clamp-2">
        <span className="font-semibold text-fg">What was said: </span>
        {line.speaker ? `${line.speaker}: ` : ''}“{line.text.trim()}”
      </p>
    </div>
  );
}
