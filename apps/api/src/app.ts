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
import { createActionItemsRouter } from './modules/actionItems/actionItems.routes';
import { createAuthRouter } from './modules/auth/auth.routes';
import { createDecisionsRouter } from './modules/decisions/decisions.routes';
import type { AnalysisQueue } from './modules/analysis/queue';
import { createGoogleClient } from './modules/integrations/googleClient';
import { createIntegrationsController } from './modules/integrations/integrations.controller';
import { createIntegrationsRouter } from './modules/integrations/integrations.routes';
import {
  createIntegrationsService,
  type IntegrationsService,
} from './modules/integrations/integrations.service';
import { createMeetingsRouter } from './modules/meetings/meetings.routes';

export type AppDeps = {
  /** Where "analyse this meeting" jobs go: pg-boss in the server, a recording fake in tests. */
  analysisQueue: AnalysisQueue;
  /** Google Calendar. Left out (tests, or a server without Google keys) = feature switched off. */
  integrations?: IntegrationsService;
};

const disabledIntegrations = () =>
  createIntegrationsService({
    google: createGoogleClient({ clientId: undefined, clientSecret: undefined, redirectUri: '' }),
    encryptionKey: undefined,
    webOrigin: env.WEB_ORIGIN,
  });

// Builds the app without starting a server, so tests can call it directly with Supertest.
// Dependencies are passed in (not imported), so tests can swap them without touching real services.
export function createApp(deps: AppDeps) {
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

  // JSON body limits: pasting a transcript (up to 1 MB of text, plus JSON escaping) needs room;
  // everything else gets a small limit. The paste parser runs first; express.json() then skips
  // requests whose body has already been read. (File uploads are multipart, handled by multer.)
  app.post('/api/meetings', express.json({ limit: '2mb' }));
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
  api.use('/meetings', createMeetingsRouter(deps));
  const integrations = createIntegrationsController(
    deps.integrations ?? disabledIntegrations(),
    env.WEB_ORIGIN,
  );
  api.use('/action-items', createActionItemsRouter(integrations));
  api.use('/integrations', createIntegrationsRouter(integrations));
  api.use('/decisions', createDecisionsRouter());
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
