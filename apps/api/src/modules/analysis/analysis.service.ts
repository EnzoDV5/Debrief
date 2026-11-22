// Analyses one meeting: three AI calls, checks the answers against the transcript, then saves.
import type { Logger } from 'pino';
import type { ZodType } from 'zod';
import { analysisRepository } from './analysis.repository';
import { AiError, FATAL, type AiClient, type AiErrorKind } from './openRouterClient';
import { checkActionItems, checkDecisions } from './postChecks';
import {
  formatDecisions,
  formatTranscript,
  parseModelJson,
  PROMPT_VERSION,
  steps,
  type AnalysisStep,
} from './prompts';

export type AnalysisJob = { meetingId: string; userId: string };

export type AnalysisDeps = {
  ai: AiClient;
  models: string[];
  log: Pick<Logger, 'info' | 'warn' | 'error'>;
};

class AnalysisFailure extends Error {
  constructor(readonly userMessage: string) {
    super(userMessage);
  }
}

const USER_MESSAGES: Record<AiErrorKind | 'invalid_output', string> = {
  daily_limit:
    "Today's free AI quota has been used up. Your transcript is saved; try again tomorrow.",
  rate_limited:
    'The AI service is busy right now. Your transcript is saved; please try again in a minute.',
  unavailable: "The AI service didn't respond. Your transcript is saved; please try again.",
  timeout: "The AI service didn't respond in time. Your transcript is saved; please try again.",
  rejected: "The AI couldn't process this transcript. Your transcript is saved; please try again.",
  empty: "The AI didn't return a result we could trust, so nothing was saved. Please try again.",
  invalid_output:
    "The AI didn't return a result we could trust, so nothing was saved. Please try again.",
  auth: 'The AI service rejected this server’s credentials. Please contact the site owner.',
  not_configured: 'AI analysis isn’t set up on this server yet (no OpenRouter API key).',
};

const UNEXPECTED =
  'Something went wrong while analysing this meeting. Your transcript is saved; please try again.';

type StepConfig<T> = {
  system: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  output: ZodType<T>;
};

type Context = { job: AnalysisJob; transcript: string; deps: AnalysisDeps };

async function runStep<T>(step: AnalysisStep, config: StepConfig<T>, ctx: Context): Promise<T> {
  const { job, transcript, deps } = ctx;
  let lastProblem: AiErrorKind | 'invalid_output' = 'not_configured';

  for (const model of deps.models) {
    const startedAt = new Date();
    const record = (status: 'success' | 'invalid_output' | 'failed', extra: object = {}) =>
      analysisRepository.recordRun({
        meetingId: job.meetingId,
        userId: job.userId,
        step,
        model,
        promptVersion: PROMPT_VERSION,
        status,
        startedAt,
        finishedAt: new Date(),
        ...extra,
      });

    let content: string;
    try {
      content = await deps.ai.complete({
        model,
        system: config.system,
        user: transcript,
        schemaName: config.schemaName,
        jsonSchema: config.jsonSchema,
      });
    } catch (err) {
      if (!(err instanceof AiError)) throw err;
      await record('failed', { error: `${err.kind}: ${err.message}` });
      deps.log.warn({ meetingId: job.meetingId, step, model, kind: err.kind }, 'AI call failed');
      if (FATAL.has(err.kind)) throw new AnalysisFailure(USER_MESSAGES[err.kind]);
      lastProblem = err.kind;
      continue;
    }

    const json = parseModelJson(content);
    const result = config.output.safeParse(json);
    if (!result.success) {
      const problems = result.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      await record('invalid_output', {
        rawOutput: json ?? { raw: content.slice(0, 10_000) },
        error: json === null ? 'Not valid JSON' : problems,
      });
      deps.log.warn({ meetingId: job.meetingId, step, model }, 'AI output failed validation');
      lastProblem = 'invalid_output';
      continue;
    }

    await record('success', { rawOutput: json });
    deps.log.info({ meetingId: job.meetingId, step, model }, 'AI step succeeded');
    return result.data;
  }

  throw new AnalysisFailure(USER_MESSAGES[lastProblem]);
}

export async function analyzeMeeting(job: AnalysisJob, deps: AnalysisDeps): Promise<void> {
  const meeting = await analysisRepository.findMeeting(job.userId, job.meetingId);
  if (!meeting) {
    deps.log.warn({ meetingId: job.meetingId }, 'Meeting no longer exists; skipping analysis');
    return;
  }

  await analysisRepository.markProcessing(job.userId, job.meetingId);
  const ctx: Context = { job, transcript: formatTranscript(meeting.transcriptLines), deps };

  try {
    const summary = await runStep('summary', steps.summary, ctx);
    const decisions = await runStep('decisions', steps.decisions, ctx);
    const checkedDecisions = checkDecisions(decisions, meeting.transcriptLines);
    // The action-items call also sees this meeting's checked decisions (numbered), so it can say
    // which decision each task carries out. Still only this one meeting's data.
    const items = await runStep('action_items', steps.action_items, {
      ...ctx,
      transcript: `${ctx.transcript}\n\n${formatDecisions(checkedDecisions)}`,
    });

    const checkedItems = checkActionItems(
      items,
      meeting.transcriptLines,
      meeting.meetingDate,
      checkedDecisions.length,
    );
    await analysisRepository.saveResults(job.userId, job.meetingId, {
      summary: summary.summary,
      decisions: checkedDecisions,
      actionItems: checkedItems,
    });
    deps.log.info(
      {
        meetingId: job.meetingId,
        decisions: decisions.decisions.length,
        actionItems: checkedItems.length,
        flagged: checkedItems.filter((i) => i.needsReview).length,
      },
      'Analysis done',
    );
  } catch (err) {
    if (err instanceof AnalysisFailure) {
      await analysisRepository.markFailed(job.userId, job.meetingId, err.userMessage);
      return;
    }
    deps.log.error({ err, meetingId: job.meetingId }, 'Analysis crashed');
    await analysisRepository.markFailed(job.userId, job.meetingId, UNEXPECTED);
    throw err;
  }
}
