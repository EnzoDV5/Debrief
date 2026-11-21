// All the database work for meetings. Filtering by userId is what keeps users out of each other's data.
import type { TranscriptLine } from '@debrief/shared';
import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { actionItems, decisions, meetings, projects, type MeetingRow } from '../../db/schema';

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

  async listForUser(
    userId: string,
    filter: { archived?: boolean; q?: string; projectId?: string } = {},
  ): Promise<MeetingListRow[]> {
    const term = filter.q?.trim().replace(/[\\%_]/g, '\\$&');
    return (
      db
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
        // Pinned first; then the user's own order (unplaced, i.e. new, meetings on top); then newest.
        .orderBy(
          sql`${meetings.pinnedAt} is null`,
          sql`${meetings.sidebarPosition} asc nulls first`,
          desc(meetings.pinnedAt),
          desc(meetings.createdAt),
        )
        .limit(LIST_LIMIT)
    );
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
        | 'title'
        | 'meetingDate'
        | 'summary'
        | 'pinnedAt'
        | 'archivedAt'
        | 'projectId'
        | 'sidebarPosition'
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

  async updateLinesForUser(
    userId: string,
    meetingId: string,
    transcriptLines: MeetingRow['transcriptLines'],
  ): Promise<MeetingRow | null> {
    const [meeting] = await db
      .update(meetings)
      .set({ transcriptLines })
      .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)))
      .returning();
    return meeting ?? null;
  },

  // Clears the sidebar's Meetings list: archives every unpinned, unarchived meeting of this user.
  async archiveAllForUser(userId: string): Promise<number> {
    const archived = await db
      .update(meetings)
      .set({ archivedAt: new Date() })
      .where(
        and(eq(meetings.userId, userId), isNull(meetings.archivedAt), isNull(meetings.pinnedAt)),
      )
      .returning({ id: meetings.id });
    return archived.length;
  },

  // Saves a sidebar order. Ids that aren't this user's simply match nothing.
  async setOrderForUser(userId: string, ids: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const [position, id] of ids.entries()) {
        await tx
          .update(meetings)
          .set({ sidebarPosition: position })
          .where(and(eq(meetings.id, id), eq(meetings.userId, userId)));
      }
    });
  },

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

  async deleteForUser(userId: string, meetingId: string): Promise<boolean> {
    const deleted = await db
      .delete(meetings)
      .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)))
      .returning({ id: meetings.id });
    return deleted.length > 0;
  },
};
