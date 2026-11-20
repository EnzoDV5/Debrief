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
        line={item.sourceLine}
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

/** Older analyses lack a saved context summary, so give them a brief, source-aware paraphrase. */
function ActionContext({ meeting, item }: { meeting: Meeting; item: ActionItem }) {
  const line = meeting.transcriptLines.find((entry) => entry.n === item.sourceLine);
  if (!line)
    return (
      <div className="text-sm text-muted">
        <p>{item.origin === 'manual' ? 'Added by you' : 'Source needs review'}</p>
        <p>No verified transcript line linked.</p>
      </div>
    );
  const summary = contextSummary(item, line);
  // A quiet quote line rather than a box: it's background, so it shouldn't compete with the task.
  return (
    <p className="border-l-2 border-line pl-3 text-sm leading-6 text-muted">
      <span className="font-semibold text-fg">In brief: </span>
      {summary}
    </p>
  );
}

function contextSummary(item: ActionItem, line: Meeting['transcriptLines'][number]): string {
  const saved = item.contextSummary?.trim();
  const normalise = (text: string) =>
    text
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  // A model can still copy the source despite the prompt. Never show that as a summary.
  if (
    saved &&
    normalise(saved) !== normalise(item.text) &&
    !normalise(line.text).includes(normalise(saved))
  ) {
    return saved;
  }

  let task = item.text
    .trim()
    .replace(/[.!?]+$/, '')
    .replace(/^./, (letter) => letter.toLowerCase());
  // Preserve a small article that the terse action title may have dropped.
  const phrase = task.match(/^(\S+)\s+([\p{L}\p{N}]+\s+[\p{L}\p{N}]+)(.*)$/u);
  if (phrase && line.text.toLocaleLowerCase().includes(`the ${phrase[2]?.toLocaleLowerCase()}`)) {
    task = `${phrase[1]} the ${phrase[2]}${phrase[3]}`;
  }
  const owner = item.owner?.trim();
  const speaker = line.speaker?.trim();
  const samePerson = Boolean(
    owner &&
    speaker &&
    (owner.toLocaleLowerCase() === speaker.toLocaleLowerCase() ||
      owner.toLocaleLowerCase().startsWith(`${speaker.toLocaleLowerCase()} `)),
  );
  let action: string;
  if (samePerson && /\b(?:I'll|I will|I'm|I am|I can|I plan to)\b/i.test(line.text)) {
    action = `${speaker} plans to ${task}`;
  } else if (
    speaker &&
    owner &&
    !samePerson &&
    /\b(?:can you|could you|would you|please)\b/i.test(line.text)
  ) {
    action = `${speaker} asked ${owner} to ${task}`;
  } else if (owner) {
    action = `${owner} needs to ${task}`;
  } else {
    action = `The team needs to ${task}`;
  }

  const completed = line.text.match(
    /\b(the [\p{L}\p{N} -]+?) is (?:done|complete|finished)\b/iu,
  )?.[1];
  return `${completed ? `With ${completed.toLowerCase()} complete, ${owner ? action : `the team needs to ${task}`}` : action}.`;
}
