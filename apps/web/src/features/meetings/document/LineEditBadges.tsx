// Says when a transcript line isn't word for word from the upload: its words were fixed, or you
// said who spoke it. Shown on the meeting page and on the check step before saving.
import type { TranscriptLine } from '@debrief/shared';
import { Pencil, UserRound } from 'lucide-react';

export function LineEditBadges({ line }: { line: TranscriptLine }) {
  if (!line.edited && !line.speakerEdited) return null;
  return (
    <p className="mt-1 flex flex-wrap gap-x-3 text-xs font-semibold text-muted">
      {line.edited && (
        <span className="inline-flex items-center gap-1">
          <Pencil aria-hidden="true" className="size-3" />
          Edited
        </span>
      )}
      {line.speakerEdited && (
        <span className="inline-flex items-center gap-1">
          <UserRound aria-hidden="true" className="size-3" />
          {line.speaker ? `Speaker set by you: ${line.speaker}` : 'Speaker removed by you'}
        </span>
      )}
    </p>
  );
}
