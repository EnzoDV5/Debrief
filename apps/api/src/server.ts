import { createApp } from './app';
import { aiModelChain, env } from './config/env';
import { logger } from './lib/logger';
import { createIntegrationsFromEnv } from './modules/integrations/integrations.service';
import { createOpenRouterClient } from './modules/analysis/openRouterClient';
import { startAnalysisWorker } from './worker';

// The background worker starts first: the api hands it jobs as soon as a meeting is saved.
const analysis = await startAnalysisWorker();

const integrations = createIntegrationsFromEnv(env);
if (!integrations.available) {
  logger.info('Google Calendar is off (GOOGLE_CLIENT_ID/SECRET or ENCRYPTION_KEY not set)');
}

const ask = {
  ai: createOpenRouterClient({
    apiKey: env.OPENROUTER_API_KEY,
    appUrl: env.APP_URL,
    // A question is an interactive request, so keep the whole fallback chain below proxy timeouts.
    timeoutMs: Math.min(env.AI_TIMEOUT_MS, 15_000),
    retryDelaysMs: [],
  }),
  models: aiModelChain(env).slice(0, 2),
};

const server = createApp({ analysisQueue: analysis, integrations, ask }).listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

// Docker and Render send SIGTERM on stop/redeploy: finish in-flight requests and the current
// analysis job (pg-boss re-runs it later if it can't finish in time), then exit.
function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    analysis.stop().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
