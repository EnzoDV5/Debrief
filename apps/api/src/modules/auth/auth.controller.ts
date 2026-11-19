import {
  deleteAccountSchema,
  loginSchema,
  registerSchema,
  type AuthResponse,
} from '@debrief/shared';
import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/requireAuth';
import { authService } from './auth.service';
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from './sessionCookie';

// HTTP in, HTTP out: validate the request, call the service, send the response. No SQL here.
// schema.parse() throws a ZodError on bad input, which the error handler turns into a 400.

function cookieToken(req: Request): string | undefined {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  return typeof token === 'string' ? token : undefined;
}

export const authController = {
  async register(req: Request, res: Response) {
    const input = registerSchema.parse(req.body);
    const { user, token } = await authService.register(input);
    setSessionCookie(res, token);
    res.status(201).json({ user } satisfies AuthResponse);
  },

  async login(req: Request, res: Response) {
    const input = loginSchema.parse(req.body);
    const { user, token } = await authService.login(input, cookieToken(req));
    setSessionCookie(res, token);
    res.json({ user } satisfies AuthResponse);
  },

  // Works whether or not the session is still valid: the goal is "logged out" either way.
  async logout(req: Request, res: Response) {
    const token = cookieToken(req);
    if (token) await authService.logout(token);
    clearSessionCookie(res);
    res.status(204).end();
  },

  me(req: Request, res: Response) {
    res.json({ user: getAuthUser(req) } satisfies AuthResponse);
  },

  async deleteAccount(req: Request, res: Response) {
    const input = deleteAccountSchema.parse(req.body);
    await authService.deleteAccount(getAuthUser(req).id, input);
    clearSessionCookie(res);
    res.status(204).end();
  },
};
