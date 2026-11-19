import { Router } from 'express';
import { createAuthRateLimiter } from '../../middleware/rateLimit';
import { requireAuth } from '../../middleware/requireAuth';
import { authController } from './auth.controller';

// Mounted at /api/auth. A factory so every app instance gets fresh rate-limit counters.
export function createAuthRouter() {
  const router = Router();

  router.post('/register', createAuthRateLimiter(), authController.register);
  router.post(
    '/login',
    createAuthRateLimiter({ skipSuccessfulRequests: true }),
    authController.login,
  );
  router.post('/logout', authController.logout);
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
