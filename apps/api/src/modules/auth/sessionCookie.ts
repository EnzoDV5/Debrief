// The session cookie: httpOnly so scripts can't read it, SameSite=Lax, 7 days, Secure in production.
import type { CookieOptions, Response } from 'express';
import { env } from '../../config/env';

export const SESSION_COOKIE = 'debrief_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  path: '/',
};

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_TTL_MS });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}
