import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { decisionsController } from './decisions.controller';

// Mounted at /api/decisions. Creating one lives under its meeting:
// POST /api/meetings/:id/decisions (see meetings.routes.ts).
export function createDecisionsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.patch('/:id', decisionsController.update);
  router.delete('/:id', decisionsController.remove);

  return router;
}
