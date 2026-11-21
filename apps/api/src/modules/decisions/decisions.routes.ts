// The /api/decisions routes.
import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { decisionsController } from './decisions.controller';

export function createDecisionsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.patch('/:id', decisionsController.update);
  router.delete('/:id', decisionsController.remove);

  return router;
}
