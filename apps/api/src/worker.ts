import { aiModelChain, env } from './config/env';
import { logger } from './lib/logger';
import { analyzeMeeting } from './modules/analysis/analysis.service';
import { createOpenRouterClient } from './modules/analysis/openRouterClient';
import { startPgBossQueue } from './modules/analysis/queue';

/**
 * Wires the real dependencies (OpenRouter, the model chain, pg-boss) into the analysis worker.
 * It runs inside the api process (see server.ts): one service to deploy on Render's free tier.
 * Splitting it into its own process later would only mean calling this from a separate entry.
 */
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
