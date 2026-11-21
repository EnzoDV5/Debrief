// HTTP for "Sign in with Google": off to Google, and back again.
import { timingSafeEqual } from 'node:crypto';
import type { GoogleSignInError as GoogleSignInErrorCode } from '@debrief/shared';
import type { CookieOptions, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { GoogleSignInRefused, type GoogleAuthService } from './googleAuth.service';
import type { WelcomeMailer } from './welcomeEmail';
import { SESSION_COOKIE, setSessionCookie } from './sessionCookie';

const SIGN_IN_COOKIE = 'debrief_google_signin';
const signInCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  path: '/api/auth/google',
  maxAge: 10 * 60 * 1000,
};
const pendingSignIn = z.object({
  state: z.string().min(1),
  verifier: z.string().min(1),
  nonce: z.string().min(1),
  next: z.string(),
});

const DEFAULT_APP_PATH = '/meetings';

const startQuery = z.object({ next: z.string().optional().catch(undefined) });
const callbackQuery = z.object({
  code: z.string().min(1).optional().catch(undefined),
  state: z.string().min(1).optional().catch(undefined),
  error: z.string().optional().catch(undefined),
});

export function safeNextPath(next: string | undefined): string {
  if (
    !next ||
    next.length > 512 ||
    !next.startsWith('/') ||
    next.startsWith('//') ||
    next.startsWith('/\\')
  ) {
    return DEFAULT_APP_PATH;
  }
  return next;
}

function sameState(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function readPendingSignIn(req: Request) {
  const raw: unknown = req.cookies?.[SIGN_IN_COOKIE];
  if (typeof raw !== 'string') return null;
  try {
    const parsed = pendingSignIn.safeParse(
      JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function createGoogleAuthController(
  service: GoogleAuthService,
  webOrigin: string,
  welcome: WelcomeMailer,
) {
  const backToLogin = (res: Response, reason: GoogleSignInErrorCode, next?: string) => {
    res.clearCookie(SIGN_IN_COOKIE, signInCookieOptions);
    const params = new URLSearchParams({ google: reason });
    if (next && next !== DEFAULT_APP_PATH) params.set('next', next);
    res.redirect(`${webOrigin}/login?${params}`);
  };

  return {
    configured: service.configured,

    start(req: Request, res: Response) {
      const next = safeNextPath(startQuery.parse(req.query).next);
      if (!service.configured) return backToLogin(res, 'unavailable', next);
      const { url, state, verifier, nonce } = service.start();
      const cookie = Buffer.from(JSON.stringify({ state, verifier, nonce, next })).toString(
        'base64url',
      );
      res.cookie(SIGN_IN_COOKIE, cookie, signInCookieOptions);
      res.redirect(url);
    },

    async callback(req: Request, res: Response) {
      const pending = readPendingSignIn(req);
      const { code, state, error } = callbackQuery.parse(req.query);

      if (error !== undefined) return backToLogin(res, 'denied', pending?.next);

      if (!pending || !code || !state || !sameState(state, pending.state)) {
        return backToLogin(res, 'error', pending?.next);
      }

      try {
        const previous: unknown = req.cookies?.[SESSION_COOKIE];
        const { user, token, created } = await service.finish(
          code,
          pending.verifier,
          pending.nonce,
          typeof previous === 'string' ? previous : undefined,
        );
        res.clearCookie(SIGN_IN_COOKIE, signInCookieOptions);
        setSessionCookie(res, token);
        const target = new URL(pending.next, webOrigin);
        target.searchParams.set('signed_in', created ? 'new' : 'back');
        res.redirect(target.toString());
        if (created) welcome.send(user);
      } catch (err) {
        if (err instanceof GoogleSignInRefused) {
          return backToLogin(res, err.reason, pending.next);
        }
        logger.warn({ err }, 'Google sign-in failed');
        backToLogin(res, 'error', pending.next);
      }
    },
  };
}

export type GoogleAuthController = ReturnType<typeof createGoogleAuthController>;
