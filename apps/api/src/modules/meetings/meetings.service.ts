import {
  parseTranscript,
  type Meeting,
  type MeetingListItem,
  type SourceType,
  type UpdateMeetingInput,
} from '@debrief/shared';
import type { MeetingRow } from '../../db/schema';
import { AppError, notFound } from '../../lib/errors';
import { meetingsRepository, type MeetingListRow } from './meetings.repository';

// Business rules for meetings. No req/res here, and no SQL (that's the repository).

function toListItem(row: MeetingListRow): MeetingListItem {
  return {
    id: row.id,
    title: row.title,
    meetingDate: row.meetingDate,
    sourceType: row.sourceType,
    analysisStatus: row.analysisStatus,
    lineCount: row.lineCount,
    createdAt: row.createdAt.toISOString(),
  };
}

function toMeeting(row: MeetingRow): Meeting {
  return {
    ...toListItem({ ...row, lineCount: row.transcriptLines.length }),
    transcriptLines: row.transcriptLines,
    summary: row.summary,
    analysisError: row.analysisError,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const meetingsService = {
  /**
   * Parses and saves straight away, before any AI is involved (Phase 3), so the transcript is
   * never lost even if analysis later fails. Status starts as 'pending'.
   */
  async create(
    userId: string,
    input: { title: string; meetingDate: string; transcript: string; sourceType: SourceType },
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
    return toMeeting(row);
  },

  async list(userId: string): Promise<MeetingListItem[]> {
    return (await meetingsRepository.listForUser(userId)).map(toListItem);
  },

  async get(userId: string, meetingId: string): Promise<Meeting> {
    const row = await meetingsRepository.findForUser(userId, meetingId);
    if (!row) throw notFound('Meeting');
    return toMeeting(row);
  },

  async update(userId: string, meetingId: string, patch: UpdateMeetingInput): Promise<Meeting> {
    const row = await meetingsRepository.updateForUser(userId, meetingId, patch);
    if (!row) throw notFound('Meeting');
    return toMeeting(row);
  },

  async remove(userId: string, meetingId: string): Promise<void> {
    if (!(await meetingsRepository.deleteForUser(userId, meetingId))) throw notFound('Meeting');
  },
};
