import type { TranscriptLine } from '@debrief/shared';
import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { actionItems, decisions, meetings, projects, type MeetingRow } from '../../db/schema';

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
  pinnedAt: meetings.pinnedAt,
  archivedAt: meetings.archivedAt,
  projectId: meetings.projectId,
  // Postgres counts the lines, so the list never loads the transcripts themselves.
  lineCount: sql<number>`jsonb_array_length(${meetings.transcriptLines})`.mapWith(Number),
};
export type MeetingListRow = Pick<
  MeetingRow,
  | 'id'
  | 'title'
  | 'meetingDate'
  | 'sourceType'
  | 'analysisStatus'
  | 'createdAt'
  | 'pinnedAt'
  | 'archivedAt'
  | 'projectId'
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
  async listForUser(
    userId: string,
    filter: { archived?: boolean; q?: string; projectId?: string } = {},
  ): Promise<MeetingListRow[]> {
    const term = filter.q?.trim().replace(/[\\%_]/g, '\\$&');
    return db
      .select(listColumns)
      .from(meetings)
      .where(
        and(
          eq(meetings.userId, userId),
          filter.archived ? isNotNull(meetings.archivedAt) : isNull(meetings.archivedAt),
          filter.projectId ? eq(meetings.projectId, filter.projectId) : undefined,
          term
            ? or(
                ilike(meetings.title, `%${term}%`),
                ilike(meetings.transcriptOriginal, `%${term}%`),
              )
            : undefined,
        ),
      )
      .orderBy(sql`${meetings.pinnedAt} desc nulls last`, desc(meetings.createdAt))
      .limit(LIST_LIMIT);
  },

  async projectBelongsToUser(userId: string, projectId: string): Promise<boolean> {
    const rows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);
    return rows.length > 0;
  },

  async findForUser(userId: string, meetingId: string): Promise<MeetingRow | null> {
    const [meeting] = await db
      .select()
      .from(meetings)
      .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)))
      .limit(1);
    return meeting ?? null;
  },

  /** The analysis results shown on the meeting page, in display order. */
  async findResultsForUser(userId: string, meetingId: string) {
    const [decisionRows, actionItemRows] = await Promise.all([
      db
        .select()
        .from(decisions)
        .where(and(eq(decisions.meetingId, meetingId), eq(decisions.userId, userId)))
        .orderBy(asc(decisions.position)),
      db
        .select()
        .from(actionItems)
        .where(and(eq(actionItems.meetingId, meetingId), eq(actionItems.userId, userId)))
        .orderBy(asc(actionItems.position)),
    ]);
    return { decisions: decisionRows, actionItems: actionItemRows };
  },

  async updateForUser(
    userId: string,
    meetingId: string,
    patch: Partial<
      Pick<
        MeetingRow,
        'title' | 'meetingDate' | 'summary' | 'pinnedAt' | 'archivedAt' | 'projectId'
      >
    >,
  ): Promise<MeetingRow | null> {
    const [meeting] = await db
      .update(meetings)
      .set(patch)
      .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)))
      .returning();
    return meeting ?? null;
  },

  /** Puts a meeting back in the queue state ('pending') before a new analysis job is sent. */
  async setAnalysisPending(userId: string, meetingId: string): Promise<MeetingRow | null> {
    const [meeting] = await db
      .update(meetings)
      .set({ analysisStatus: 'pending', analysisError: null })
      .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)))
      .returning();
    return meeting ?? null;
  },

  async setAnalysisFailed(userId: string, meetingId: string, message: string): Promise<void> {
    await db
      .update(meetings)
      .set({ analysisStatus: 'failed', analysisError: message })
      .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)));
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
