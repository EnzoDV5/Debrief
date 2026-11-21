// The /api/search route.
import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth';
import { searchController } from './search.controller';

export function createSearchRouter() {
  const router = Router();
  router.use(requireAuth);
  router.get('/', searchController.search);
  return router;
}
