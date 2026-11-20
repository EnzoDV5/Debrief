import { timingSafeEqual } from 'node:crypto';
import type { GoogleSignInError as GoogleSignInErrorCode } from '@debrief/shared';
import type { CookieOptions, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { GoogleSignInRefused, type GoogleAuthService } from './googleAuth.service';
import type { WelcomeMailer } from './welcomeEmail';
import { SESSION_COOKIE, setSessionCookie } from './sessionCookie';

// HTTP for Sign in with Google: two full-page redirects (to Google and back), no JSON forms.
// Every failure lands back on the login page with a one-word reason, never a raw error page.

// What the browser keeps between "go to Google" and "back from Google", in a short-lived
// httpOnly cookie scoped to these routes. SameSite=Lax still sends it when Google redirects
// back (a top-level GET navigation), but never on cross-site background requests.
const SIGN_IN_COOKIE = 'debrief_google_signin';
const signInCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  path: '/api/auth/google',
  maxAge: 10 * 60 * 1000, // 10 minutes to get through Google's screens
};
const pendingSignIn = z.object({
  state: z.string().min(1),
  verifier: z.string().min(1),
  nonce: z.string().min(1),
  next: z.string(),
});

const DEFAULT_APP_PATH = '/meetings';

// The query strings, validated like every other route's input. Anything unexpected becomes
// undefined, which the handlers treat as a failed sign-in rather than a 400 page.
const startQuery = z.object({ next: z.string().optional().catch(undefined) });
const callbackQuery = z.object({
  code: z.string().min(1).optional().catch(undefined),
  state: z.string().min(1).optional().catch(undefined),
  error: z.string().optional().catch(undefined),
});

/**
 * Where to go after signing in. Only paths inside the app: anything else could turn this into
 * an "open redirect" to another site. Same rule as safeRedirect in the web app.
 */
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

/** Constant-time comparison, so the state can't be guessed byte by byte from response times. */
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
  /** Back to the login page with a reason it turns into a message (keeping ?next= if any). */
  const backToLogin = (res: Response, reason: GoogleSignInErrorCode, next?: string) => {
    res.clearCookie(SIGN_IN_COOKIE, signInCookieOptions);
    const params = new URLSearchParams({ google: reason });
    if (next && next !== DEFAULT_APP_PATH) params.set('next', next);
    res.redirect(`${webOrigin}/login?${params}`);
  };

  return {
    /** Whether Google sign-in is set up on this server (see GET /auth/providers). */
    configured: service.configured,

    /** GET /auth/google/start?next=/meetings/123: a full-page navigation that ends at Google. */
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

    /** GET /auth/google/callback: where Google sends the user back. */
    async callback(req: Request, res: Response) {
      const pending = readPendingSignIn(req);
      const { code, state, error } = callbackQuery.parse(req.query);

      // The person pressed Cancel on Google's screen (or Google refused): not an error on our side.
      if (error !== undefined) return backToLogin(res, 'denied', pending?.next);

      // CSRF protection: the state Google echoes back must be the one we put in THIS browser's
      // cookie. Otherwise another site is trying to finish a sign-in it started (e.g. to log the
      // user into the attacker's account). Also catches an expired cookie (> 10 minutes).
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
        // signed_in tells the app to play its entrance, and to welcome a brand-new account. The
        // app reads it once and takes it out of the address bar.
        const target = new URL(pending.next, webOrigin);
        target.searchParams.set('signed_in', created ? 'new' : 'back');
        res.redirect(target.toString());
        if (created) welcome.send(user); // a brand-new account: after the redirect
      } catch (err) {
        if (err instanceof GoogleSignInRefused) {
          return backToLogin(res, err.reason, pending.next);
        }
        // Google down, a bad code, a failed check: log it (no tokens or personal data) and
        // send the person back to try again.
        logger.warn({ err }, 'Google sign-in failed');
        backToLogin(res, 'error', pending.next);
      }
    },
  };
}

export type GoogleAuthController = ReturnType<typeof createGoogleAuthController>;
