// CSRF guard on top of the SameSite cookie: changes are refused if they come from another site.
import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from '../lib/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const originCheck: RequestHandler = (req, _res, next) => {
  const origin = req.get('origin');
  if (SAFE_METHODS.has(req.method) || origin === undefined || origin === env.WEB_ORIGIN) {
    next();
    return;
  }
  next(new AppError(403, 'FORBIDDEN_ORIGIN', 'Request blocked: unexpected origin'));
};
