// HTTP layer for action items: validate the request, call the service, send the answer.
import {
  actionItemsQuerySchema,
  createActionItemSchema,
  updateActionItemSchema,
  type ActionItem,
} from '@debrief/shared';
import type { Request, Response } from 'express';
import { uuidParam } from '../../lib/params';
import { getAuthUser } from '../../middleware/requireAuth';
import { actionItemsService } from './actionItems.service';

export const actionItemsController = {
  async list(req: Request, res: Response) {
    const query = actionItemsQuerySchema.parse(req.query);
    res.json(await actionItemsService.list(getAuthUser(req).id, query));
  },

  async create(req: Request, res: Response) {
    const meetingId = uuidParam(req, 'id', 'Meeting');
    const input = createActionItemSchema.parse(req.body);
    const actionItem = await actionItemsService.create(getAuthUser(req).id, meetingId, input);
    res.status(201).json({ actionItem } satisfies { actionItem: ActionItem });
  },

  async update(req: Request, res: Response) {
    const id = uuidParam(req, 'id', 'Action item');
    const patch = updateActionItemSchema.parse(req.body);
    const actionItem = await actionItemsService.update(getAuthUser(req).id, id, patch);
    res.json({ actionItem } satisfies { actionItem: ActionItem });
  },

  async remove(req: Request, res: Response) {
    await actionItemsService.remove(getAuthUser(req).id, uuidParam(req, 'id', 'Action item'));
    res.status(204).end();
  },
};
