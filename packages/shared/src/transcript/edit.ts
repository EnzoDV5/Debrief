// Applies a fix to one transcript line: new words, who spoke it, or both. Each change is flagged
// on the line, so the app can say it isn't word for word from the upload any more.
import type { TranscriptLine } from '../schemas/meetings';

export type LinePatch = { text?: string; speaker?: string | null };

export function applyLineEdit(line: TranscriptLine, patch: LinePatch): TranscriptLine {
  let next: TranscriptLine = { ...line };
  if (patch.text !== undefined) next = { ...next, text: patch.text, edited: true };
  if (patch.speaker !== undefined) {
    // A removed speaker drops the key, matching how the parser stores lines with no speaker.
    const { speaker: _old, ...rest } = next;
    next = patch.speaker
      ? { ...rest, speaker: patch.speaker, speakerEdited: true }
      : { ...rest, speakerEdited: true };
  }
  return next;
}
