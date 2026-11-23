// HTTP layer for register, log in, log out, me (and changing your name) and delete account.
import {
  deleteAccountSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
  type AuthResponse,
} from '@debrief/shared';
import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/requireAuth';
import { authService } from './auth.service';
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from './sessionCookie';

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
    return user;
  },

  async login(req: Request, res: Response) {
    const input = loginSchema.parse(req.body);
    const { user, token } = await authService.login(input, cookieToken(req));
    setSessionCookie(res, token);
    res.json({ user } satisfies AuthResponse);
  },

  async logout(req: Request, res: Response) {
    const token = cookieToken(req);
    if (token) await authService.logout(token);
    clearSessionCookie(res);
    res.status(204).end();
  },

  me(req: Request, res: Response) {
    res.json({ user: getAuthUser(req) } satisfies AuthResponse);
  },

  async updateProfile(req: Request, res: Response) {
    const input = updateProfileSchema.parse(req.body);
    const user = await authService.updateProfile(getAuthUser(req).id, input);
    res.json({ user } satisfies AuthResponse);
  },

  async uploadAvatar(req: Request, res: Response) {
    const user = await authService.uploadAvatar(getAuthUser(req).id, req.file?.buffer);
    res.json({ user } satisfies AuthResponse);
  },

  async avatar(req: Request, res: Response) {
    const { contentType, data } = await authService.getUploadedAvatar(getAuthUser(req).id);
    // The URL is versioned (?v=), so the browser may keep it; private keeps shared caches out.
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=31536000, immutable',
    });
    res.send(data);
  },

  async removeAvatar(req: Request, res: Response) {
    const user = await authService.removeAvatar(getAuthUser(req).id);
    res.json({ user } satisfies AuthResponse);
  },

  async deleteAccount(req: Request, res: Response) {
    const input = deleteAccountSchema.parse(req.body);
    await authService.deleteAccount(getAuthUser(req).id, input);
    clearSessionCookie(res);
    res.status(204).end();
  },
};
