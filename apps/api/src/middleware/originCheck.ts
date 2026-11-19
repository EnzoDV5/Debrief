import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from '../lib/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection, layer 2 (layer 1 is the SameSite=Lax cookie).
 * Browsers always send an Origin header on cross-site POST/PATCH/DELETE. If it's there and it
 * isn't our web app, a different website is trying to act as the user: reject it.
 * No Origin header means a non-browser client (curl, Postman), which can't carry a victim's
 * cookies anyway, so it's allowed.
 */
export const originCheck: RequestHandler = (req, _res, next) => {
  const origin = req.get('origin');
  if (SAFE_METHODS.has(req.method) || origin === undefined || origin === env.WEB_ORIGIN) {
    next();
    return;
  }
  next(new AppError(403, 'FORBIDDEN_ORIGIN', 'Request blocked: unexpected origin'));
};
