import {
  parseTranscript,
  type Meeting,
  type MeetingListItem,
  type SourceType,
  type UpdateMeetingInput,
} from '@debrief/shared';
import type { MeetingRow } from '../../db/schema';
import { AppError, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import type { AnalysisQueue } from '../analysis/queue';
import { toListItem, toMeeting } from './meetings.mappers';
import { meetingsRepository } from './meetings.repository';

// Business rules for meetings. No req/res here, and no SQL (that's the repository).

// A job stuck in 'processing' this long almost certainly died with its server; allow a re-run.
const STALE_PROCESSING_MS = 10 * 60 * 1000;

async function withResults(userId: string, row: MeetingRow): Promise<Meeting> {
  return toMeeting(row, await meetingsRepository.findResultsForUser(userId, row.id));
}

export const meetingsService = {
  /**
   * Saves first, then queues the analysis. The order matters: the transcript is stored before
   * any AI is involved, so it's never lost, and the response doesn't wait for the AI at all.
   */
  async create(
    userId: string,
    input: { title: string; meetingDate: string; transcript: string; sourceType: SourceType },
    queue: AnalysisQueue,
  ): Promise<Meeting> {
    const lines = parseTranscript(input.transcript, input.sourceType);
    if (lines.length === 0) {
      const message = 'No readable transcript text was found';
      throw new AppError(400, 'EMPTY_TRANSCRIPT', message, { transcript: message });
    }

    const row = await meetingsRepository.create({
      userId,
      title: input.title,
      meetingDate: input.meetingDate,
      transcriptOriginal: input.transcript,
      transcriptLines: lines,
      sourceType: input.sourceType,
    });

    try {
      await queue.enqueue({ meetingId: row.id, userId });
    } catch (err) {
      // The meeting is saved either way; show a Retry path instead of leaving it pending forever.
      logger.error({ err, meetingId: row.id }, 'Could not queue analysis');
      const message = "Couldn't start the analysis. Please try again.";
      await meetingsRepository.setAnalysisFailed(userId, row.id, message);
      return withResults(userId, { ...row, analysisStatus: 'failed', analysisError: message });
    }
    return toMeeting(row, { decisions: [], actionItems: [] });
  },

  /** Retry after a failure, or re-run a finished analysis. Hand-made items are kept. */
  async requestAnalysis(userId: string, meetingId: string, queue: AnalysisQueue): Promise<Meeting> {
    const current = await meetingsRepository.findForUser(userId, meetingId);
    if (!current) throw notFound('Meeting');

    const runningFor = Date.now() - current.updatedAt.getTime();
    if (current.analysisStatus === 'processing' && runningFor < STALE_PROCESSING_MS) {
      throw new AppError(409, 'ANALYSIS_RUNNING', 'This meeting is already being analysed');
    }

    const row = await meetingsRepository.setAnalysisPending(userId, meetingId);
    if (!row) throw notFound('Meeting');
    try {
      await queue.enqueue({ meetingId, userId });
    } catch (err) {
      logger.error({ err, meetingId }, 'Could not queue analysis');
      const message = "Couldn't start the analysis. Please try again.";
      await meetingsRepository.setAnalysisFailed(userId, meetingId, message);
      throw new AppError(503, 'QUEUE_UNAVAILABLE', message);
    }
    return withResults(userId, row);
  },

  async list(userId: string): Promise<MeetingListItem[]> {
    return (await meetingsRepository.listForUser(userId)).map(toListItem);
  },

  async get(userId: string, meetingId: string): Promise<Meeting> {
    const row = await meetingsRepository.findForUser(userId, meetingId);
    if (!row) throw notFound('Meeting');
    return withResults(userId, row);
  },

  async update(userId: string, meetingId: string, patch: UpdateMeetingInput): Promise<Meeting> {
    const row = await meetingsRepository.updateForUser(userId, meetingId, patch);
    if (!row) throw notFound('Meeting');
    return withResults(userId, row);
  },

  async remove(userId: string, meetingId: string): Promise<void> {
    if (!(await meetingsRepository.deleteForUser(userId, meetingId))) throw notFound('Meeting');
  },
};
