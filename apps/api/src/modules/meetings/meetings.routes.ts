// The /api/meetings routes, plus adding decisions and action items to a meeting.
import { Router } from 'express';
import type { AppDeps } from '../../app';
import { requireAuth } from '../../middleware/requireAuth';
import { createAskRateLimiter } from '../../middleware/rateLimit';
import { transcriptUpload } from '../../middleware/upload';
import { actionItemsController } from '../actionItems/actionItems.controller';
import { decisionsController } from '../decisions/decisions.controller';
import { createAskController } from '../analysis/ask.controller';
import { createMeetingsController } from './meetings.controller';

export function createMeetingsRouter(deps: AppDeps) {
  const router = Router();
  const meetingsController = createMeetingsController(deps.analysisQueue);
  router.use(requireAuth);

  router.get('/', meetingsController.list);
  router.post('/', transcriptUpload, meetingsController.create);
  router.get('/:id', meetingsController.get);
  router.post('/:id/ask', createAskRateLimiter(), createAskController(deps.ask));
  router.post('/:id/analyze', meetingsController.analyze);
  router.patch('/:id', meetingsController.update);
  router.patch('/:id/lines/:n', meetingsController.updateLine);
  router.delete('/:id', meetingsController.remove);

  router.post('/:id/action-items', actionItemsController.create);
  router.post('/:id/decisions', decisionsController.create);

  return router;
}
