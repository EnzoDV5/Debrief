import type { ApiErrorBody } from '@debrief/shared';
import { rateLimit } from 'express-rate-limit';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * Slows down password guessing: 10 attempts per 15 minutes per IP.
 * A factory, so each app instance (and each test) gets its own counter.
 * `skipSuccessfulRequests` is for login: only failed attempts count, so logging in and out
 * during a demo never locks you out.
 */
export function createAuthRateLimiter({ skipSuccessfulRequests = false } = {}) {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 10,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8', // RateLimit-* headers tell clients when to retry
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in 15 minutes.' },
      } satisfies ApiErrorBody);
    },
  });
}
