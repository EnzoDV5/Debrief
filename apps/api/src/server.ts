import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';

const server = createApp().listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

// Docker and Render send SIGTERM on stop/redeploy: finish in-flight requests, then exit.
function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
