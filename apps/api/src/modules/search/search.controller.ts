// HTTP layer for search: validate the optional ?q=, call the service, send the results.
import { searchQuerySchema, type SearchResponse } from '@debrief/shared';
import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/requireAuth';
import { searchService } from './search.service';

export const searchController = {
  async search(req: Request, res: Response) {
    const { q } = searchQuerySchema.parse(req.query);
    const results = await searchService.search(getAuthUser(req).id, q || undefined);
    res.json(results satisfies SearchResponse);
  },
};
