// When a user picks a quote for their own item, make sure it really is on that transcript line.
import type { TranscriptLine } from '@debrief/shared';
import { AppError } from '../../lib/errors';
import { quoteIsOnLine } from '../analysis/postChecks';

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
