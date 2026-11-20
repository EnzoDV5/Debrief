import { forgotPasswordSchema, resetPasswordSchema } from '@debrief/shared';
import type { Request, Response } from 'express';
import { logger } from '../../lib/logger';
import type { PasswordResetService } from './passwordReset.service';

// HTTP for "Forgot password". Validate, call the service, answer. No SQL here.

export function createPasswordResetController(service: PasswordResetService) {
  return {
    /**
     * POST /auth/forgot-password { email }. Always 202 with the same body, answered BEFORE the
     * work is done: whether an account exists (and an email is being sent) changes neither the
     * answer nor how long it takes.
     */
    async forgot(req: Request, res: Response) {
      const { email } = forgotPasswordSchema.parse(req.body);
      res.status(202).json({ ok: true });
      try {
        await service.request(email);
      } catch (err) {
        // Too late to tell the browser (it already has its answer), so log it for us.
        logger.error({ err }, 'Sending the password reset email failed');
      }
    },

    /** POST /auth/reset-password { token, password } */
    async reset(req: Request, res: Response) {
      const { token, password } = resetPasswordSchema.parse(req.body);
      await service.reset(token, password);
      res.status(204).end();
    },
  };
}

export type PasswordResetController = ReturnType<typeof createPasswordResetController>;
