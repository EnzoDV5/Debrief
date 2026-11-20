import type { AuthProviders } from '@debrief/shared';
import { Router } from 'express';
import { createAuthRateLimiter } from '../../middleware/rateLimit';
import { requireAuth } from '../../middleware/requireAuth';
import { authController } from './auth.controller';
import type { GoogleAuthController } from './googleAuth.controller';
import type { PasswordResetController } from './passwordReset.controller';
import type { WelcomeMailer } from './welcomeEmail';

// Mounted at /api/auth. A factory so every app instance gets fresh rate-limit counters.
export function createAuthRouter({
  google,
  passwordReset,
  passwordResetAvailable,
  welcome,
}: {
  google: GoogleAuthController;
  passwordReset: PasswordResetController;
  passwordResetAvailable: boolean;
  welcome: WelcomeMailer;
}) {
  const router = Router();

  // Which sign-in options the web app should offer (each only when set up on the server).
  router.get('/providers', (_req, res) => {
    res.json({
      google: google.configured,
      passwordReset: passwordResetAvailable,
    } satisfies AuthProviders);
  });
  // Sign in with Google: two full-page redirects. Starting one is rate-limited like a login, so
  // the api can't be used to hammer Google's token endpoint.
  router.get('/google/start', createAuthRateLimiter(), google.start);
  router.get('/google/callback', google.callback);

  router.post('/register', createAuthRateLimiter(), async (req, res) => {
    const user = await authController.register(req, res);
    welcome.send(user); // after the answer: never slows down or fails a sign-up
  });
  router.post(
    '/login',
    createAuthRateLimiter({ skipSuccessfulRequests: true }),
    authController.login,
  );
  router.post('/logout', authController.logout);

  // Forgot password. Both rate-limited: asking sends email (don't let anyone spam an inbox or
  // our EmailJS quota), and resetting tries a token (no unlimited guessing).
  router.post('/forgot-password', createAuthRateLimiter(), passwordReset.forgot);
  router.post(
    '/reset-password',
    createAuthRateLimiter({ skipSuccessfulRequests: true }),
    passwordReset.reset,
  );

  router.get('/me', requireAuth, authController.me);
  // Rate-limited too: it checks a password, so it must not allow unlimited guesses.
  router.delete(
    '/account',
    requireAuth,
    createAuthRateLimiter({ skipSuccessfulRequests: true }),
    authController.deleteAccount,
  );

  return router;
}
