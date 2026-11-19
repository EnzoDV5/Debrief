import type { TranscriptLine, UpdateMeetingInput } from '@debrief/shared';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { meetings, type MeetingRow } from '../../db/schema';

// The only file in the meetings module that talks to the database.
// Every query filters by userId. That single rule is what stops one user reaching another user's
// meetings: a wrong id simply finds nothing, which the service turns into a 404.

/** Columns for the list: everything except the (potentially large) transcript text. */
const listColumns = {
  id: meetings.id,
  title: meetings.title,
  meetingDate: meetings.meetingDate,
  sourceType: meetings.sourceType,
  analysisStatus: meetings.analysisStatus,
  createdAt: meetings.createdAt,
  // Postgres counts the lines, so the list never loads the transcripts themselves.
  lineCount: sql<number>`jsonb_array_length(${meetings.transcriptLines})`.mapWith(Number),
};
export type MeetingListRow = Pick<
  MeetingRow,
  'id' | 'title' | 'meetingDate' | 'sourceType' | 'analysisStatus' | 'createdAt'
> & { lineCount: number };

const LIST_LIMIT = 200;

export const meetingsRepository = {
  async create(data: {
    userId: string;
    title: string;
    meetingDate: string;
    transcriptOriginal: string;
    transcriptLines: TranscriptLine[];
    sourceType: MeetingRow['sourceType'];
  }): Promise<MeetingRow> {
    const [meeting] = await db.insert(meetings).values(data).returning();
    if (!meeting) throw new Error('Insert returned no row');
    return meeting;
  },

  /** Newest first. Capped so one request can't return an unbounded list. */
  async listForUser(userId: string): Promise<MeetingListRow[]> {
    return db
      .select(listColumns)
      .from(meetings)
      .where(eq(meetings.userId, userId))
      .orderBy(desc(meetings.createdAt))
      .limit(LIST_LIMIT);
  },

  async findForUser(userId: string, meetingId: string): Promise<MeetingRow | null> {
    const [meeting] = await db
      .select()
      .from(meetings)
      .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)))
      .limit(1);
    return meeting ?? null;
  },

  async updateForUser(
    userId: string,
    meetingId: string,
    patch: UpdateMeetingInput,
  ): Promise<MeetingRow | null> {
    const [meeting] = await db
      .update(meetings)
      .set(patch)
      .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)))
      .returning();
    return meeting ?? null;
  },

  /** Returns false if there was nothing (of this user's) to delete. */
  async deleteForUser(userId: string, meetingId: string): Promise<boolean> {
    const deleted = await db
      .delete(meetings)
      .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)))
      .returning({ id: meetings.id });
    return deleted.length > 0;
  },
};
