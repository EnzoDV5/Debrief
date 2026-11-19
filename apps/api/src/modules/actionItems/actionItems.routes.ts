import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import type { IntegrationsController } from '../integrations/integrations.controller';
import { actionItemsController } from './actionItems.controller';

// Mounted at /api/action-items. Creating one lives under its meeting:
// POST /api/meetings/:id/action-items (see meetings.routes.ts).
export function createActionItemsRouter(integrations: IntegrationsController) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', actionItemsController.list);
  router.patch('/:id', actionItemsController.update);
  router.delete('/:id', actionItemsController.remove);
  router.post('/:id/calendar', integrations.addToCalendar);

  return router;
}
