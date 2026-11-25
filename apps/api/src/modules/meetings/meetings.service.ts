// Rules for meetings: save the transcript first, then queue the analysis.
import {
  applyLineEdit,
  ARCHIVE_WHILE_ANALYSING_MESSAGE,
  EDIT_WHILE_ANALYSING_MESSAGE,
  isAnalysing,
  parseTranscript,
  type LineEdit,
  RENAME_WHILE_ANALYSING_MESSAGE,
  type Meeting,
  type MeetingListItem,
  type SourceType,
  type TranscriptLine,
  type UpdateMeetingInput,
  type UpdateTranscriptLineInput,
} from '@debrief/shared';
import type { MeetingRow } from '../../db/schema';
import { AppError, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import type { AnalysisQueue } from '../analysis/queue';
import { toListItem, toMeeting } from './meetings.mappers';
import { meetingsRepository } from './meetings.repository';

// If an analysis has been "processing" this long, its server probably died, so a retry is allowed.
const STALE_PROCESSING_MS = 10 * 60 * 1000;

async function withResults(userId: string, row: MeetingRow): Promise<Meeting> {
  return toMeeting(row, await meetingsRepository.findResultsForUser(userId, row.id));
}

function applyLineEdits(lines: TranscriptLine[], edits: LineEdit[]): TranscriptLine[] {
  const byLine = new Map(edits.map((edit) => [edit.n, edit]));
  const missing = edits.find((edit) => !lines.some((line) => line.n === edit.n));
  if (missing) {
    const message = `Line ${missing.n} isn’t in this transcript`;
    throw new AppError(400, 'LINE_NOT_FOUND', message, { lineEdits: message });
  }
  return lines.map((line) => {
    const edit = byLine.get(line.n);
    return edit ? applyLineEdit(line, edit) : line;
  });
}

export const meetingsService = {
  async create(
    userId: string,
    input: {
      title: string;
      meetingDate: string;
      transcript: string;
      sourceType: SourceType;
      lineEdits?: LineEdit[];
    },
    queue: AnalysisQueue,
  ): Promise<Meeting> {
    const parsed = parseTranscript(input.transcript, input.sourceType);
    if (parsed.length === 0) {
      const message = 'No readable transcript text was found';
      throw new AppError(400, 'EMPTY_TRANSCRIPT', message, { transcript: message });
    }
    // Fixes made on the check step go in before the AI reads the lines. The original text is
    // still saved as it came.
    const lines = applyLineEdits(parsed, input.lineEdits ?? []);

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
      logger.error({ err, meetingId: row.id }, 'Could not queue analysis');
      const message = "Couldn't start the analysis. Please try again.";
      await meetingsRepository.setAnalysisFailed(userId, row.id, message);
      return withResults(userId, { ...row, analysisStatus: 'failed', analysisError: message });
    }
    return toMeeting(row, { decisions: [], actionItems: [] });
  },

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

  async list(
    userId: string,
    filter: { archived?: boolean; q?: string; projectId?: string } = {},
  ): Promise<MeetingListItem[]> {
    if (
      filter.projectId &&
      !(await meetingsRepository.projectBelongsToUser(userId, filter.projectId))
    )
      throw notFound('Project');
    return (await meetingsRepository.listForUser(userId, filter)).map(toListItem);
  },

  async get(userId: string, meetingId: string): Promise<Meeting> {
    const row = await meetingsRepository.findForUser(userId, meetingId);
    if (!row) throw notFound('Meeting');
    return withResults(userId, row);
  },

  async update(userId: string, meetingId: string, patch: UpdateMeetingInput): Promise<Meeting> {
    if (
      patch.projectId &&
      !(await meetingsRepository.projectBelongsToUser(userId, patch.projectId))
    )
      throw notFound('Project');
    // Some changes wait until the analysis finishes. Archiving hides the meeting from the list
    // the app is watching (the result looks lost); renaming can change the meeting date that
    // relative deadlines are worked out from. Pinning, projects and restoring are always fine.
    const archiving = patch.archived === true;
    const renaming = patch.title !== undefined || patch.meetingDate !== undefined;
    if (archiving || renaming) {
      const current = await meetingsRepository.findForUser(userId, meetingId);
      if (!current) throw notFound('Meeting');
      if (isAnalysing(current.analysisStatus))
        throw new AppError(
          409,
          'ANALYSIS_RUNNING',
          renaming ? RENAME_WHILE_ANALYSING_MESSAGE : ARCHIVE_WHILE_ANALYSING_MESSAGE,
        );
    }
    const { pinned, archived, ...fields } = patch;
    const row = await meetingsRepository.updateForUser(userId, meetingId, {
      ...fields,
      // Pinning or unpinning puts the meeting at the top of its new section.
      ...(pinned !== undefined
        ? { pinnedAt: pinned ? new Date() : null, sidebarPosition: null }
        : {}),
      ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
    });
    if (!row) throw notFound('Meeting');
    return withResults(userId, row);
  },

  // Fixes a line's words and/or who said it. Each change is flagged on the line, so the page can
  // say it isn't word for word from the upload any more (the original transcript is kept).
  async updateLine(
    userId: string,
    meetingId: string,
    n: number,
    patch: UpdateTranscriptLineInput,
  ): Promise<Meeting> {
    const row = await meetingsRepository.findForUser(userId, meetingId);
    if (!row) throw notFound('Meeting');
    if (!row.transcriptLines.some((line) => line.n === n)) throw notFound('Line');
    if (isAnalysing(row.analysisStatus))
      throw new AppError(409, 'ANALYSIS_RUNNING', EDIT_WHILE_ANALYSING_MESSAGE);
    const lines = row.transcriptLines.map((line) =>
      line.n === n ? applyLineEdit(line, patch) : line,
    );
    const updated = await meetingsRepository.updateLinesForUser(userId, meetingId, lines);
    if (!updated) throw notFound('Meeting');
    return withResults(userId, updated);
  },

  async archiveAll(userId: string): Promise<number> {
    return meetingsRepository.archiveAllForUser(userId);
  },

  async reorder(userId: string, ids: string[]): Promise<void> {
    await meetingsRepository.setOrderForUser(userId, ids);
  },

  async remove(userId: string, meetingId: string): Promise<void> {
    if (!(await meetingsRepository.deleteForUser(userId, meetingId))) throw notFound('Meeting');
  },
};
