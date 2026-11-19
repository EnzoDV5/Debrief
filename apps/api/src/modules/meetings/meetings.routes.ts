import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { transcriptUpload } from '../../middleware/upload';
import { meetingsController } from './meetings.controller';

// Mounted at /api/meetings. Every route needs a logged-in user.
export function createMeetingsRouter() {
  const router = Router();
  // Auth runs before the upload is read, so anonymous requests are rejected without
  // buffering their files.
  router.use(requireAuth);

  router.get('/', meetingsController.list);
  router.post('/', transcriptUpload, meetingsController.create);
  router.get('/:id', meetingsController.get);
  router.patch('/:id', meetingsController.update);
  router.delete('/:id', meetingsController.remove);

  return router;
}
