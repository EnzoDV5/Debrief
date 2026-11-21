// HTTP layer for decisions.
import { createDecisionSchema, updateDecisionSchema, type Decision } from '@debrief/shared';
import type { Request, Response } from 'express';
import { uuidParam } from '../../lib/params';
import { getAuthUser } from '../../middleware/requireAuth';
import { decisionsService } from './decisions.service';

export const decisionsController = {
  async create(req: Request, res: Response) {
    const meetingId = uuidParam(req, 'id', 'Meeting');
    const input = createDecisionSchema.parse(req.body);
    const decision = await decisionsService.create(getAuthUser(req).id, meetingId, input);
    res.status(201).json({ decision } satisfies { decision: Decision });
  },

  async update(req: Request, res: Response) {
    const id = uuidParam(req, 'id', 'Decision');
    const input = updateDecisionSchema.parse(req.body);
    const decision = await decisionsService.update(getAuthUser(req).id, id, input);
    res.json({ decision } satisfies { decision: Decision });
  },

  async remove(req: Request, res: Response) {
    await decisionsService.remove(getAuthUser(req).id, uuidParam(req, 'id', 'Decision'));
    res.status(204).end();
  },
};
