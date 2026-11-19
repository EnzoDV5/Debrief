import { randomUUID } from 'node:crypto';
import type { HealthResponse } from '@debrief/shared';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { originCheck } from './middleware/originCheck';
import { createAuthRouter } from './modules/auth/auth.routes';

// Builds the app without starting a server, so tests can call it directly with Supertest.
export function createApp() {
  const app = express();

  // Behind nginx/Render, read the real client IP from X-Forwarded-For (needed for rate limits).
  app.set('trust proxy', env.TRUST_PROXY);

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
  app.use(cookieParser());

  // All routes live under /api so the web app can proxy one path prefix (same origin = first-party cookies).
  const api = express.Router();
  api.use(originCheck);
  // Responses contain personal data: browsers and proxies must not cache them.
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  api.get('/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok' };
    res.json(body);
  });
  api.use('/auth', createAuthRouter());
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
