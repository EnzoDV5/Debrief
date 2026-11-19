import type { CookieOptions, Response } from 'express';
import { env } from '../../config/env';

export const SESSION_COOKIE = 'debrief_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const cookieOptions: CookieOptions = {
  httpOnly: true, // JavaScript can't read it, so an XSS bug can't steal the session
  sameSite: 'lax', // not sent on cross-site POSTs (CSRF layer 1; originCheck is layer 2)
  secure: env.NODE_ENV === 'production', // HTTPS only in production (localhost is exempt)
  path: '/',
};

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_TTL_MS });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}
