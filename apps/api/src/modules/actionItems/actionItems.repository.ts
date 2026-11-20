import { UNASSIGNED_OWNER, type ActionItemStatus, type TranscriptLine } from '@debrief/shared';
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, ne, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db/client';
import { actionItems, meetings, type ActionItemRow } from '../../db/schema';

// The only file in this module that talks to the database. Every query filters by userId.

export type ActionItemFilters = {
  statuses: ActionItemStatus[] | null; // null = any status
  owner?: string;
  overdueOn?: string; // "overdue as of this date"
};

export const actionItemsRepository = {
  /** The meeting's numbered lines, or null if it isn't this user's meeting. */
  async findTranscriptLines(userId: string, meetingId: string): Promise<TranscriptLine[] | null> {
    const [row] = await db
      .select({ lines: meetings.transcriptLines })
      .from(meetings)
      .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)))
      .limit(1);
    return row?.lines ?? null;
  },

  /** New hand-made items go to the end of the meeting's list. */
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

  /** "My open items": every meeting's items, with the meeting's title and date. */
  async listForUser(userId: string, filters: ActionItemFilters) {
    const conditions: SQL[] = [eq(actionItems.userId, userId)];
    if (filters.statuses) conditions.push(inArray(actionItems.status, filters.statuses));
    if (filters.owner === UNASSIGNED_OWNER) {
      conditions.push(isNull(actionItems.owner));
    } else if (filters.owner) {
      // Case-insensitive: "thandi" and "Thandi" are the same person.
      conditions.push(sql`lower(${actionItems.owner}) = lower(${filters.owner})`);
    }
    if (filters.overdueOn) {
      // Overdue = has a due date before today AND isn't done.
      conditions.push(
        isNotNull(actionItems.dueDate),
        lt(actionItems.dueDate, filters.overdueOn),
        ne(actionItems.status, 'done'),
      );
    }

    return (
      db
        .select({
          item: actionItems,
          meetingTitle: meetings.title,
          meetingDate: meetings.meetingDate,
        })
        .from(actionItems)
        // The join also re-checks ownership of the meeting itself.
        .innerJoin(
          meetings,
          and(eq(meetings.id, actionItems.meetingId), eq(meetings.userId, userId)),
        )
        .where(and(...conditions))
        // Soonest due first, undated items last, then newest meeting first.
        .orderBy(
          sql`${actionItems.dueDate} asc nulls last`,
          desc(meetings.createdAt),
          asc(actionItems.position),
        )
        .limit(500)
    );
  },

  /** Distinct owner names for the filter dropdown, alphabetical. */
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
