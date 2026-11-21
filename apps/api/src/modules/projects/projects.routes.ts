// The /api/projects routes.
import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { projectsController } from './projects.controller';

export function createProjectsRouter() {
  const router = Router();
  router.use(requireAuth);
  router.get('/', projectsController.list);
  router.post('/', projectsController.create);
  router.patch('/:id', projectsController.update);
  router.delete('/:id', projectsController.remove);
  return router;
}
