// The /api/action-items routes.
import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import type { IntegrationsController } from '../integrations/integrations.controller';
import { actionItemsController } from './actionItems.controller';

export function createActionItemsRouter(integrations: IntegrationsController) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', actionItemsController.list);
  router.patch('/:id', actionItemsController.update);
  router.delete('/:id', actionItemsController.remove);
  router.post('/:id/calendar', integrations.addToCalendar);

  return router;
}
