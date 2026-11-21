// Lets a request through only with a valid session cookie, and attaches the user to it.
import type { PublicUser } from '@debrief/shared';
import type { Request, RequestHandler } from 'express';
import { unauthenticated } from '../lib/errors';
import { authService } from '../modules/auth/auth.service';
import { SESSION_COOKIE } from '../modules/auth/sessionCookie';

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

export function getAuthUser(req: Request): PublicUser {
  if (!req.user) throw unauthenticated();
  return req.user;
}
