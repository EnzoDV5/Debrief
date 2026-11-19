import {
  createMeetingFromTextSchema,
  meetingDetailsSchema,
  updateMeetingSchema,
  type Meeting,
  type MeetingListItem,
} from '@debrief/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { notFound } from '../../lib/errors';
import { readTranscriptFile } from '../../lib/transcriptFile';
import { getAuthUser } from '../../middleware/requireAuth';
import { meetingsService } from './meetings.service';

// HTTP in, HTTP out: validate the request, call the service, send the response. No SQL here.

/**
 * A malformed id gets the same 404 as someone else's meeting: the response never reveals
 * whether an id exists, so ids can't be probed.
 */
function meetingId(req: Request): string {
  const result = z.uuid().safeParse(req.params.id);
  if (!result.success) throw notFound('Meeting');
  return result.data;
}

/** POST /meetings takes either a JSON paste or a multipart file upload. */
function readCreateInput(req: Request) {
  if (req.file) {
    const details = meetingDetailsSchema.parse(req.body);
    const { text, sourceType } = readTranscriptFile(req.file);
    return { ...details, transcript: text, sourceType };
  }
  const { transcript, ...details } = createMeetingFromTextSchema.parse(req.body);
  return { ...details, transcript, sourceType: 'paste' as const };
}

export const meetingsController = {
  async create(req: Request, res: Response) {
    const meeting = await meetingsService.create(getAuthUser(req).id, readCreateInput(req));
    res.status(201).json({ meeting } satisfies { meeting: Meeting });
  },

  async list(req: Request, res: Response) {
    const meetings = await meetingsService.list(getAuthUser(req).id);
    res.json({ meetings } satisfies { meetings: MeetingListItem[] });
  },

  async get(req: Request, res: Response) {
    const meeting = await meetingsService.get(getAuthUser(req).id, meetingId(req));
    res.json({ meeting } satisfies { meeting: Meeting });
  },

  async update(req: Request, res: Response) {
    const id = meetingId(req);
    const patch = updateMeetingSchema.parse(req.body);
    const meeting = await meetingsService.update(getAuthUser(req).id, id, patch);
    res.json({ meeting } satisfies { meeting: Meeting });
  },

  async remove(req: Request, res: Response) {
    await meetingsService.remove(getAuthUser(req).id, meetingId(req));
    res.status(204).end();
  },
};
