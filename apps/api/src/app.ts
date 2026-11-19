import { randomUUID } from 'node:crypto';
import type { HealthResponse } from '@debrief/shared';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Builds the app without starting a server, so tests can call it directly with Supertest.
export function createApp() {
  const app = express();

  // Security headers (no X-Powered-By, nosniff, frame protection, etc.).
  app.use(helmet());

  // One log line per request, tagged with a fresh request id. The id is also returned in the
  // X-Request-Id header so a user-reported error can be matched to its log line.
  // We always generate it ourselves rather than trusting one sent by the client.
  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => {
        const id = randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
    }),
  );

  // Small default body limit. Transcript upload (Phase 2) will set its own 1 MB limit on that route.
  app.use(express.json({ limit: '100kb' }));

  // All routes live under /api so the web app can proxy one path prefix (same origin = first-party cookies).
  const api = express.Router();
  api.get('/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok' };
    res.json(body);
  });
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
