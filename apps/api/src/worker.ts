// Hooks the real AI client and model list into the background job that analyses meetings.
import { aiModelChain, env } from './config/env';
import { logger } from './lib/logger';
import { analyzeMeeting } from './modules/analysis/analysis.service';
import { createOpenRouterClient } from './modules/analysis/openRouterClient';
import { startPgBossQueue } from './modules/analysis/queue';

export function startAnalysisWorker() {
  const ai = createOpenRouterClient({
    apiKey: env.OPENROUTER_API_KEY,
    appUrl: env.APP_URL,
    timeoutMs: env.AI_TIMEOUT_MS,
  });
  const models = aiModelChain(env);
  if (!env.OPENROUTER_API_KEY) {
    logger.warn('OPENROUTER_API_KEY is not set: analyses will fail with a clear message');
  }

  return startPgBossQueue({
    connectionString: env.DATABASE_URL,
    handler: (job) => analyzeMeeting(job, { ai, models, log: logger }),
    log: logger,
  });
}
