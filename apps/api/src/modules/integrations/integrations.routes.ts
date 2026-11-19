import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import type { IntegrationsController } from './integrations.controller';

// Mounted at /api/integrations. Adding an item to the calendar lives with the item:
// POST /api/action-items/:id/calendar (see actionItems.routes.ts).
export function createIntegrationsRouter(controller: IntegrationsController) {
  const router = Router();
  router.use(requireAuth);

  router.get('/google', controller.status);
  router.get('/google/connect', controller.connect);
  router.get('/google/callback', controller.callback);
  router.delete('/google', controller.disconnect);

  return router;
}
