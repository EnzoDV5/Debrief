import type { TranscriptLine } from '@debrief/shared';
import { AppError } from '../../lib/errors';
import { quoteIsOnLine } from '../analysis/postChecks';

/**
 * A source the user picked for a hand-made item (by selecting text on the meeting page) gets the
 * same check as the AI's: the line must be in this meeting's transcript, and the quoted words
 * must really be on it. A wrong source is a 400 (the request is wrong), never saved silently.
 */
export function assertPickedSource(
  lines: TranscriptLine[],
  sourceLine: number | null,
  sourceQuote: string | null = null,
): void {
  if (sourceLine === null) {
    if (sourceQuote !== null) {
      throw invalid('sourceQuote', 'A quote needs the line it comes from');
    }
    return;
  }
  const line = lines.find((l) => l.n === sourceLine);
  if (!line) throw invalid('sourceLine', `Line ${sourceLine} isn't in this transcript`);
  if (sourceQuote !== null && !quoteIsOnLine(line, sourceQuote)) {
    throw invalid('sourceQuote', `Those words aren't on line ${sourceLine}`);
  }
}

function invalid(field: string, message: string) {
  return new AppError(400, 'VALIDATION_ERROR', message, { [field]: message });
}
