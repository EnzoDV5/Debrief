// Starts everything: the analysis worker first, then the web server, and shuts both down cleanly.
import { createApp } from './app';
import { aiModelChain, env } from './config/env';
import { logger } from './lib/logger';
import { createEmailJsClient } from './modules/auth/emailClient';
import { createGoogleSignInClient } from './modules/auth/googleSignIn';
import { createIntegrationsFromEnv } from './modules/integrations/integrations.service';
import { createOpenRouterClient } from './modules/analysis/openRouterClient';
import { startAnalysisWorker } from './worker';

const analysis = await startAnalysisWorker();

const integrations = createIntegrationsFromEnv(env);
if (!integrations.available) {
  logger.info('Google Calendar is off (GOOGLE_CLIENT_ID/SECRET or ENCRYPTION_KEY not set)');
}

const googleSignIn = createGoogleSignInClient({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: env.GOOGLE_AUTH_REDIRECT_URI,
});
if (!googleSignIn.configured) {
  logger.info('Sign in with Google is off (GOOGLE_CLIENT_ID/SECRET not set)');
}

const email = createEmailJsClient({
  serviceId: env.EMAILJS_SERVICE_ID,
  templateId: env.EMAILJS_TEMPLATE_ID,
  publicKey: env.EMAILJS_PUBLIC_KEY,
  privateKey: env.EMAILJS_PRIVATE_KEY,
  welcomeTemplateId: env.EMAILJS_WELCOME_TEMPLATE_ID,
});
if (!email.configured) {
  logger.info('Password reset emails are off (EMAILJS_* not set)');
}

const ask = {
  ai: createOpenRouterClient({
    apiKey: env.OPENROUTER_API_KEY,
    appUrl: env.APP_URL,
    timeoutMs: Math.min(env.AI_TIMEOUT_MS, 15_000),
    retryDelaysMs: [],
  }),
  models: aiModelChain(env).slice(0, 2),
};

const server = createApp({
  analysisQueue: analysis,
  integrations,
  googleSignIn,
  email,
  ask,
}).listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    analysis.stop().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
