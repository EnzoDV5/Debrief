// When a user picks a quote for their own item, make sure it really is on that transcript line.
import {
  EDIT_WHILE_ANALYSING_MESSAGE,
  isAnalysing,
  type AnalysisStatus,
  type TranscriptLine,
} from '@debrief/shared';
import { AppError } from '../../lib/errors';
import { quoteIsOnLine } from '../analysis/postChecks';

// New action items and decisions wait until the AI has finished reading the transcript.
export function assertNotAnalysing(status: AnalysisStatus): void {
  if (isAnalysing(status))
    throw new AppError(409, 'ANALYSIS_RUNNING', EDIT_WHILE_ANALYSING_MESSAGE);
}

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
