// HTTP layer for meetings: paste or upload, list, open, edit, delete and re-analyse.
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
import type { AnalysisQueue } from '../analysis/queue';

function meetingId(req: Request): string {
  const result = z.uuid().safeParse(req.params.id);
  if (!result.success) throw notFound('Meeting');
  return result.data;
}

function readCreateInput(req: Request) {
  if (req.file) {
    const details = meetingDetailsSchema.parse(req.body);
    const { text, sourceType } = readTranscriptFile(req.file);
    return { ...details, transcript: text, sourceType };
  }
  const { transcript, ...details } = createMeetingFromTextSchema.parse(req.body);
  return { ...details, transcript, sourceType: 'paste' as const };
}

export function createMeetingsController(queue: AnalysisQueue) {
  return {
    async create(req: Request, res: Response) {
      const meeting = await meetingsService.create(
        getAuthUser(req).id,
        readCreateInput(req),
        queue,
      );
      res.status(201).json({ meeting } satisfies { meeting: Meeting });
    },

    async list(req: Request, res: Response) {
      const query = z
        .object({
          archived: z.enum(['true', 'false']).optional(),
          q: z.string().trim().max(200).optional(),
          projectId: z.uuid().optional(),
        })
        .parse(req.query);
      const meetings = await meetingsService.list(getAuthUser(req).id, {
        archived: query.archived === 'true',
        q: query.q,
        projectId: query.projectId,
      });
      res.json({ meetings } satisfies { meetings: MeetingListItem[] });
    },

    async get(req: Request, res: Response) {
      const meeting = await meetingsService.get(getAuthUser(req).id, meetingId(req));
      res.json({ meeting } satisfies { meeting: Meeting });
    },

    async analyze(req: Request, res: Response) {
      const meeting = await meetingsService.requestAnalysis(
        getAuthUser(req).id,
        meetingId(req),
        queue,
      );
      res.status(202).json({ meeting } satisfies { meeting: Meeting });
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
}
