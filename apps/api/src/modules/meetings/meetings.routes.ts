import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { transcriptUpload } from '../../middleware/upload';
import { createMeetingsController } from './meetings.controller';
import type { AppDeps } from '../../app';

// Mounted at /api/meetings. Every route needs a logged-in user.
export function createMeetingsRouter(deps: AppDeps) {
  const router = Router();
  const meetingsController = createMeetingsController(deps.analysisQueue);
  // Auth runs before the upload is read, so anonymous requests are rejected without
  // buffering their files.
  router.use(requireAuth);

  router.get('/', meetingsController.list);
  router.post('/', transcriptUpload, meetingsController.create);
  router.get('/:id', meetingsController.get);
  router.post('/:id/analyze', meetingsController.analyze);
  router.patch('/:id', meetingsController.update);
  router.delete('/:id', meetingsController.remove);

  return router;
}
