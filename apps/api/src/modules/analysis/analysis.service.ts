import type { Logger } from 'pino';
import type { ZodType } from 'zod';
import { analysisRepository } from './analysis.repository';
import { AiError, FATAL, type AiClient, type AiErrorKind } from './openRouterClient';
import { checkActionItems, checkDecisions } from './postChecks';
import {
  formatTranscript,
  parseModelJson,
  PROMPT_VERSION,
  steps,
  type AnalysisStep,
} from './prompts';

// Runs the analysis for one meeting. Called by the background worker, never by a web request,
// so a slow or failing AI can never make the website hang.
//
// Flow: load meeting (scoped to its owner) → 'processing' → summary, decisions, action items
// (each tries the model chain) → post-checks → save everything in one transaction → 'done'.
// Any failure → 'failed' with a message the user can act on. The transcript is never touched.

export type AnalysisJob = { meetingId: string; userId: string };

export type AnalysisDeps = {
  ai: AiClient;
  /** Models to try, in order. */
  models: string[];
  log: Pick<Logger, 'info' | 'warn' | 'error'>;
};

/** A failure we expected and can explain to the user. */
class AnalysisFailure extends Error {
  constructor(readonly userMessage: string) {
    super(userMessage);
  }
}

// Shown on the meeting page. Each says the transcript is safe and what to do next.
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

/**
 * One step (e.g. "action_items"): try each model until one returns output that parses AND passes
 * the Zod schema. Every attempt is recorded in analysis_runs. Malformed, partial or wrong-shaped
 * output counts as 'invalid_output' and moves on to the next model; it is never saved.
 */
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
      // Logged without any transcript or AI text, only what happened.
      deps.log.warn({ meetingId: job.meetingId, step, model, kind: err.kind }, 'AI call failed');
      // No other model can fix a used-up daily quota, a bad key or a missing key: stop now.
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
  // User isolation: this prompt contains this one meeting's transcript and nothing else. Every
  // AI call is a fresh, independent request: no shared history, no other user's data.
  const ctx: Context = { job, transcript: formatTranscript(meeting.transcriptLines), deps };

  try {
    // One after another (not in parallel): gentler on free-tier rate limits, and a used-up
    // daily quota stops the run after the first call instead of three.
    const summary = await runStep('summary', steps.summary, ctx);
    const decisions = await runStep('decisions', steps.decisions, ctx);
    const items = await runStep('action_items', steps.action_items, ctx);

    const checkedItems = checkActionItems(items, meeting.transcriptLines, meeting.meetingDate);
    await analysisRepository.saveResults(job.userId, job.meetingId, {
      summary: summary.summary,
      decisions: checkDecisions(decisions, meeting.transcriptLines),
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
    // Unexpected failures may be transient (for example a dropped database connection).
    // Let pg-boss retry the job; a successful retry will replace this error state.
    throw err;
  }
}
