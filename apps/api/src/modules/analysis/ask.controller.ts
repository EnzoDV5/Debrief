// HTTP layer for "Ask this meeting".
import { askMeetingInputSchema, type AskMeetingResponse } from '@debrief/shared';
import type { Request, Response } from 'express';
import { uuidParam } from '../../lib/params';
import { getAuthUser } from '../../middleware/requireAuth';
import { askMeeting, type AskDeps } from './ask.service';

export function createAskController(deps?: AskDeps) {
  return async (req: Request, res: Response) => {
    const id = uuidParam(req, 'id', 'Meeting');
    const { question } = askMeetingInputSchema.parse(req.body);
    const answer = await askMeeting(getAuthUser(req).id, id, question, deps);
    res.json(answer satisfies AskMeetingResponse);
  };
}
