// HTTP for "Forgot password". Always the same answer, so nobody can tell which emails have accounts.
import { forgotPasswordSchema, resetPasswordSchema } from '@debrief/shared';
import type { Request, Response } from 'express';
import { logger } from '../../lib/logger';
import type { PasswordResetService } from './passwordReset.service';

export function createPasswordResetController(service: PasswordResetService) {
  return {
    async forgot(req: Request, res: Response) {
      const { email } = forgotPasswordSchema.parse(req.body);
      res.status(202).json({ ok: true });
      try {
        await service.request(email);
      } catch (err) {
        logger.error({ err }, 'Sending the password reset email failed');
      }
    },

    async reset(req: Request, res: Response) {
      const { token, password } = resetPasswordSchema.parse(req.body);
      await service.reset(token, password);
      res.status(204).end();
    },
  };
}

export type PasswordResetController = ReturnType<typeof createPasswordResetController>;
