// The /api/integrations routes.
import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import type { IntegrationsController } from './integrations.controller';

export function createIntegrationsRouter(controller: IntegrationsController) {
  const router = Router();
  router.use(requireAuth);

  router.get('/google', controller.status);
  router.get('/google/connect', controller.connect);
  router.get('/google/callback', controller.callback);
  router.delete('/google', controller.disconnect);

  return router;
}
