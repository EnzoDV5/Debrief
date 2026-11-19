import { timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { uuidParam } from '../../lib/params';
import { getAuthUser } from '../../middleware/requireAuth';
import type { IntegrationsService } from './integrations.service';

// The OAuth "state" and PKCE verifier live in a short-lived, httpOnly cookie between the redirect
// to Google and the callback. SameSite=Lax still sends it when Google redirects back (a top-level
// GET navigation), but never on cross-site background requests.
const OAUTH_COOKIE = 'debrief_google_oauth';
const oauthCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  path: '/api/integrations/google',
  maxAge: 10 * 60 * 1000, // 10 minutes to get through Google's consent screen
};

/** Constant-time comparison, so the state can't be guessed byte by byte from response times. */
function sameState(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createIntegrationsController(service: IntegrationsService, webOrigin: string) {
  /** Back to the Account page with a one-word result the page turns into a message. */
  const backToAccount = (res: Response, result: string) => {
    res.clearCookie(OAUTH_COOKIE, oauthCookieOptions);
    res.redirect(`${webOrigin}/account?calendar=${result}`);
  };

  return {
    async status(req: Request, res: Response) {
      res.json(await service.status(getAuthUser(req).id));
    },

    /** GET /integrations/google/connect: a full-page navigation that ends at Google. */
    connect(_req: Request, res: Response) {
      if (!service.available) return backToAccount(res, 'unavailable');
      const { url, state, verifier } = service.startConnect();
      res.cookie(OAUTH_COOKIE, `${state}.${verifier}`, oauthCookieOptions);
      res.redirect(url);
    },

    /** GET /integrations/google/callback: where Google sends the user back. */
    async callback(req: Request, res: Response) {
      const { code, state, error } = req.query;
      if (typeof error === 'string') return backToAccount(res, 'denied'); // user clicked "Cancel"

      const cookie: unknown = req.cookies?.[OAUTH_COOKIE];
      const [expectedState, verifier] = typeof cookie === 'string' ? cookie.split('.') : [];
      // CSRF protection: the state Google echoes back must be the one we put in this browser's
      // cookie. Otherwise someone is trying to attach their Google account to this user.
      if (
        typeof code !== 'string' ||
        typeof state !== 'string' ||
        !expectedState ||
        !verifier ||
        !sameState(state, expectedState)
      ) {
        return backToAccount(res, 'error');
      }

      try {
        await service.finishConnect(getAuthUser(req).id, code, verifier);
        backToAccount(res, 'connected');
      } catch (err) {
        logger.warn({ err }, 'Google Calendar connection failed');
        backToAccount(res, 'error');
      }
    },

    async disconnect(req: Request, res: Response) {
      await service.disconnect(getAuthUser(req).id);
      res.status(204).end();
    },

    /** POST /action-items/:id/calendar */
    async addToCalendar(req: Request, res: Response) {
      const itemId = uuidParam(req, 'id', 'Action item');
      res.json(await service.addToCalendar(getAuthUser(req).id, itemId));
    },
  };
}

export type IntegrationsController = ReturnType<typeof createIntegrationsController>;
