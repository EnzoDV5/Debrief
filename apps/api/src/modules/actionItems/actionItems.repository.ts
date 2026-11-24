// All the database work for action items. Every query is filtered by the logged-in user.
import {
  UNASSIGNED_OWNER,
  type ActionItemStatus,
  type AnalysisStatus,
  type TranscriptLine,
} from '@debrief/shared';
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, ne, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db/client';
import { actionItems, decisions, meetings, type ActionItemRow } from '../../db/schema';

export type ActionItemFilters = {
  statuses: ActionItemStatus[] | null;
  owner?: string;
  overdueOn?: string;
};

export const actionItemsRepository = {
  // What adding a note by hand needs to know: the lines it may point at, and whether the AI is
  // still analysing the meeting.
  async findForNewNote(
    userId: string,
    meetingId: string,
  ): Promise<{ lines: TranscriptLine[]; analysisStatus: AnalysisStatus } | null> {
    const [row] = await db
      .select({ lines: meetings.transcriptLines, analysisStatus: meetings.analysisStatus })
      .from(meetings)
      .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)))
      .limit(1);
    return row ?? null;
  },

  // A task may only point at a decision from the same meeting, owned by the same user.
  async decisionIsInMeeting(userId: string, meetingId: string, decisionId: string) {
    const [row] = await db
      .select({ id: decisions.id })
      .from(decisions)
      .where(
        and(
          eq(decisions.id, decisionId),
          eq(decisions.meetingId, meetingId),
          eq(decisions.userId, userId),
        ),
      )
      .limit(1);
    return Boolean(row);
  },

  async nextPosition(userId: string, meetingId: string): Promise<number> {
    const [row] = await db
      .select({ next: sql<number>`coalesce(max(${actionItems.position}) + 1, 0)`.mapWith(Number) })
      .from(actionItems)
      .where(and(eq(actionItems.meetingId, meetingId), eq(actionItems.userId, userId)));
    return row?.next ?? 0;
  },

  async create(data: typeof actionItems.$inferInsert): Promise<ActionItemRow> {
    const [row] = await db.insert(actionItems).values(data).returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  },

  async findForUser(userId: string, id: string): Promise<ActionItemRow | null> {
    const [row] = await db
      .select()
      .from(actionItems)
      .where(and(eq(actionItems.id, id), eq(actionItems.userId, userId)))
      .limit(1);
    return row ?? null;
  },

  async updateForUser(
    userId: string,
    id: string,
    patch: Partial<typeof actionItems.$inferInsert>,
  ): Promise<ActionItemRow | null> {
    const [row] = await db
      .update(actionItems)
      .set(patch)
      .where(and(eq(actionItems.id, id), eq(actionItems.userId, userId)))
      .returning();
    return row ?? null;
  },

  async deleteForUser(userId: string, id: string): Promise<boolean> {
    const deleted = await db
      .delete(actionItems)
      .where(and(eq(actionItems.id, id), eq(actionItems.userId, userId)))
      .returning({ id: actionItems.id });
    return deleted.length > 0;
  },

  async listForUser(userId: string, filters: ActionItemFilters) {
    const conditions: SQL[] = [eq(actionItems.userId, userId)];
    if (filters.statuses) conditions.push(inArray(actionItems.status, filters.statuses));
    if (filters.owner === UNASSIGNED_OWNER) {
      conditions.push(isNull(actionItems.owner));
    } else if (filters.owner) {
      conditions.push(sql`lower(${actionItems.owner}) = lower(${filters.owner})`);
    }
    if (filters.overdueOn) {
      conditions.push(
        isNotNull(actionItems.dueDate),
        lt(actionItems.dueDate, filters.overdueOn),
        ne(actionItems.status, 'done'),
      );
    }

    return db
      .select({
        item: actionItems,
        meetingTitle: meetings.title,
        meetingDate: meetings.meetingDate,
      })
      .from(actionItems)
      .innerJoin(meetings, and(eq(meetings.id, actionItems.meetingId), eq(meetings.userId, userId)))
      .where(and(...conditions))
      .orderBy(
        sql`${actionItems.dueDate} asc nulls last`,
        desc(meetings.createdAt),
        asc(actionItems.position),
      )
      .limit(500);
  },

  async ownersForUser(userId: string): Promise<string[]> {
    const rows = await db
      .selectDistinct({ owner: actionItems.owner })
      .from(actionItems)
      .where(and(eq(actionItems.userId, userId), isNotNull(actionItems.owner)));
    return rows
      .map((r) => r.owner)
      .filter((o): o is string => Boolean(o))
      .sort((a, b) => a.localeCompare(b));
  },
};
