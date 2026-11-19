import type { PublicUser } from '@debrief/shared';
import type { Request, RequestHandler } from 'express';
import { unauthenticated } from '../lib/errors';
import { authService } from '../modules/auth/auth.service';
import { SESSION_COOKIE } from '../modules/auth/sessionCookie';

/**
 * Gate for every route that needs a logged-in user. Looks up the session from the cookie and
 * attaches the user to the request; otherwise responds 401.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  const result = typeof token === 'string' ? await authService.getSession(token) : null;
  if (!result) {
    next(unauthenticated());
    return;
  }
  req.user = result.user;
  req.sessionTokenHash = result.tokenHash;
  next();
};

/** Read the user set by requireAuth. Throws (→ 401) if a route forgot to use requireAuth. */
export function getAuthUser(req: Request): PublicUser {
  if (!req.user) throw unauthenticated();
  return req.user;
}
