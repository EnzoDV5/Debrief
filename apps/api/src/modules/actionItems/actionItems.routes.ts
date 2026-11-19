import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { actionItemsController } from './actionItems.controller';

// Mounted at /api/action-items. Creating one lives under its meeting:
// POST /api/meetings/:id/action-items (see meetings.routes.ts).
export function createActionItemsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/', actionItemsController.list);
  router.patch('/:id', actionItemsController.update);
  router.delete('/:id', actionItemsController.remove);

  return router;
}
