import type { AskMeetingResponse, TranscriptLine } from '@debrief/shared';
import { AppError, notFound } from '../../lib/errors';
import { analysisRepository } from './analysis.repository';
import { askJsonSchema, askOutput, askSystem } from './ask.prompts';
import { AiError, FATAL, type AiClient } from './openRouterClient';
import { normalise } from './postChecks';
import { formatTranscript, parseModelJson } from './prompts';

export type AskDeps = { ai: AiClient; models: string[] };

function sourceLines(
  sources: { line: number; quote: string }[],
  lines: TranscriptLine[],
): number[] | null {
  const byNumber = new Map(lines.map((line) => [line.n, line]));
  const found = new Set<number>();
  for (const source of sources) {
    const line = byNumber.get(source.line);
    const quote = normalise(source.quote);
    const original = line && normalise(`${line.speaker ? `${line.speaker}: ` : ''}${line.text}`);
    if (!line || quote.length < 4 || !original?.includes(quote)) return null;
    found.add(line.n);
  }
  return [...found];
}

function aiUnavailable(error: AiError): AppError {
  if (error.kind === 'daily_limit')
    return new AppError(429, 'AI_DAILY_LIMIT', "Today's AI quota is used up. Try again tomorrow.");
  if (error.kind === 'rate_limited')
    return new AppError(429, 'AI_BUSY', 'The AI is busy. Try again in a minute.');
  if (error.kind === 'not_configured' || error.kind === 'auth')
    return new AppError(503, 'AI_UNAVAILABLE', 'Meeting questions are unavailable right now.');
  return new AppError(503, 'AI_UNAVAILABLE', "The AI couldn't answer right now. Please try again.");
}

/** A question is answered from this user's saved transcript; no conversation crosses meetings. */
export async function askMeeting(
  userId: string,
  meetingId: string,
  question: string,
  deps?: AskDeps,
): Promise<AskMeetingResponse> {
  const meeting = await analysisRepository.findMeeting(userId, meetingId);
  if (!meeting) throw notFound('Meeting');
  if (!deps?.models.length)
    throw new AppError(503, 'AI_UNAVAILABLE', 'Meeting questions are unavailable right now.');

  // Neutralise XML-looking tags in the question just as formatTranscript does for transcript text.
  const safeQuestion = question.replace(/</g, '‹').replace(/>/g, '›');
  const user = `${formatTranscript(meeting.transcriptLines)}\n<question>${safeQuestion}</question>`;
  let lastError: AiError | null = null;
  let noAnswerSeen = false;
  for (const model of deps.models) {
    let raw: string;
    try {
      raw = await deps.ai.complete({
        model,
        system: askSystem,
        user,
        schemaName: 'meeting_question',
        jsonSchema: askJsonSchema,
      });
    } catch (error) {
      if (!(error instanceof AiError)) throw error;
      if (FATAL.has(error.kind)) throw aiUnavailable(error);
      lastError = error;
      continue;
    }

    const parsed = askOutput.safeParse(parseModelJson(raw));
    if (!parsed.success) continue;
    if (parsed.data.answer === null) {
      noAnswerSeen = true;
      continue;
    }
    const citations = sourceLines(parsed.data.sources, meeting.transcriptLines);
    if (citations) return { answer: parsed.data.answer, citations };
  }

  if (noAnswerSeen) return { answer: null, citations: [] };
  if (lastError) throw aiUnavailable(lastError);
  throw new AppError(
    502,
    'UNSUPPORTED_ANSWER',
    "The AI couldn't give a sourced answer. Try again.",
  );
}
