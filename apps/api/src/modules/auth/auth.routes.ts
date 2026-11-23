// The /api/auth routes, with rate limits on the sign-in ones.
import type { AuthProviders } from '@debrief/shared';
import { Router } from 'express';
import { createAuthRateLimiter } from '../../middleware/rateLimit';
import { requireAuth } from '../../middleware/requireAuth';
import { avatarUpload } from '../../middleware/upload';
import { authController } from './auth.controller';
import type { GoogleAuthController } from './googleAuth.controller';
import type { PasswordResetController } from './passwordReset.controller';
import type { WelcomeMailer } from './welcomeEmail';

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

  router.get('/providers', (_req, res) => {
    res.json({
      google: google.configured,
      passwordReset: passwordResetAvailable,
    } satisfies AuthProviders);
  });
  router.get('/google/start', createAuthRateLimiter(), google.start);
  router.get('/google/callback', google.callback);

  router.post('/register', createAuthRateLimiter(), async (req, res) => {
    const user = await authController.register(req, res);
    welcome.send(user);
  });
  router.post(
    '/login',
    createAuthRateLimiter({ skipSuccessfulRequests: true }),
    authController.login,
  );
  router.post('/logout', authController.logout);

  router.post('/forgot-password', createAuthRateLimiter(), passwordReset.forgot);
  router.post(
    '/reset-password',
    createAuthRateLimiter({ skipSuccessfulRequests: true }),
    passwordReset.reset,
  );

  router.get('/me', requireAuth, authController.me);
  router.patch('/me', requireAuth, authController.updateProfile);
  router.get('/me/avatar', requireAuth, authController.avatar);
  router.put('/me/avatar', requireAuth, avatarUpload, authController.uploadAvatar);
  router.delete('/me/avatar', requireAuth, authController.removeAvatar);
  router.delete(
    '/account',
    requireAuth,
    createAuthRateLimiter({ skipSuccessfulRequests: true }),
    authController.deleteAccount,
  );

  return router;
}
