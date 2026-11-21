// Slows down password guessing and spammy questions by limiting requests per IP.
import type { ApiErrorBody } from '@debrief/shared';
import { rateLimit } from 'express-rate-limit';
import { getAuthUser } from './requireAuth';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export function createAuthRateLimiter({ skipSuccessfulRequests = false } = {}) {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 10,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in 15 minutes.' },
      } satisfies ApiErrorBody);
    },
  });
}

export function createAskRateLimiter() {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 20,
    keyGenerator: (req) => getAuthUser(req).id,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many questions. Try again in 15 minutes.' },
      } satisfies ApiErrorBody);
    },
  });
}
