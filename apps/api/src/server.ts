import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { startAnalysisWorker } from './worker';

// The background worker starts first: the api hands it jobs as soon as a meeting is saved.
const analysis = await startAnalysisWorker();

const server = createApp({ analysisQueue: analysis }).listen(env.PORT, () => {
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
