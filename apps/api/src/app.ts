// Puts the Express app together (security, logging, routes) without starting it, so tests can use it directly.
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
import { createEmailJsClient, type EmailClient } from './modules/auth/emailClient';
import { createGoogleAuthController } from './modules/auth/googleAuth.controller';
import { createGoogleAuthService } from './modules/auth/googleAuth.service';
import { createGoogleSignInClient, type GoogleSignInClient } from './modules/auth/googleSignIn';
import { createPasswordResetController } from './modules/auth/passwordReset.controller';
import { createPasswordResetService } from './modules/auth/passwordReset.service';
import { createWelcomeMailer } from './modules/auth/welcomeEmail';
import { createDecisionsRouter } from './modules/decisions/decisions.routes';
import type { AnalysisQueue } from './modules/analysis/queue';
import type { AskDeps } from './modules/analysis/ask.service';
import { createGoogleClient } from './modules/integrations/googleClient';
import { createIntegrationsController } from './modules/integrations/integrations.controller';
import { createIntegrationsRouter } from './modules/integrations/integrations.routes';
import {
  createIntegrationsService,
  type IntegrationsService,
} from './modules/integrations/integrations.service';
import { createMeetingsRouter } from './modules/meetings/meetings.routes';
import { createProjectsRouter } from './modules/projects/projects.routes';

export type AppDeps = {
  analysisQueue: AnalysisQueue;
  ask?: AskDeps;
  integrations?: IntegrationsService;
  googleSignIn?: GoogleSignInClient;
  email?: EmailClient;
};

const disabledIntegrations = () =>
  createIntegrationsService({
    google: createGoogleClient({ clientId: undefined, clientSecret: undefined, redirectUri: '' }),
    encryptionKey: undefined,
    webOrigin: env.WEB_ORIGIN,
  });

const disabledEmail = () =>
  createEmailJsClient({
    serviceId: undefined,
    templateId: undefined,
    publicKey: undefined,
    privateKey: undefined,
  });

const disabledGoogleSignIn = () =>
  createGoogleSignInClient({ clientId: undefined, clientSecret: undefined, redirectUri: '' });

export function createApp(deps: AppDeps) {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY);

  app.use(helmet());

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

  app.post('/api/meetings', express.json({ limit: '2mb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(originCheck);
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  api.get('/health', (_req, res) => {
    const body: HealthResponse = { status: 'ok' };
    res.json(body);
  });
  const email = deps.email ?? disabledEmail();
  const welcome = createWelcomeMailer({ email, webOrigin: env.WEB_ORIGIN });
  const googleAuth = createGoogleAuthController(
    createGoogleAuthService(deps.googleSignIn ?? disabledGoogleSignIn()),
    env.WEB_ORIGIN,
    welcome,
  );
  const passwordReset = createPasswordResetService({
    email,
    webOrigin: env.WEB_ORIGIN,
    showLinkInLogs: env.NODE_ENV === 'development',
  });
  api.use(
    '/auth',
    createAuthRouter({
      google: googleAuth,
      passwordReset: createPasswordResetController(passwordReset),
      passwordResetAvailable: passwordReset.available,
      welcome,
    }),
  );
  api.use('/meetings', createMeetingsRouter(deps));
  api.use('/projects', createProjectsRouter());
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
