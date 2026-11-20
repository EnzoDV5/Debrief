import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { decisions, type DecisionRow } from '../../db/schema';

// The only file in this module that talks to the database. Every query filters by userId.

export const decisionsRepository = {
  async nextPosition(userId: string, meetingId: string): Promise<number> {
    const [row] = await db
      .select({ next: sql<number>`coalesce(max(${decisions.position}) + 1, 0)`.mapWith(Number) })
      .from(decisions)
      .where(and(eq(decisions.meetingId, meetingId), eq(decisions.userId, userId)));
    return row?.next ?? 0;
  },

  async create(data: typeof decisions.$inferInsert): Promise<DecisionRow> {
    const [row] = await db.insert(decisions).values(data).returning();
    if (!row) throw new Error('Insert returned no row');
    return row;
  },

  async findForUser(userId: string, id: string): Promise<DecisionRow | null> {
    const [row] = await db
      .select()
      .from(decisions)
      .where(and(eq(decisions.id, id), eq(decisions.userId, userId)));
    return row ?? null;
  },

  async updateForUser(
    userId: string,
    id: string,
    patch: Pick<typeof decisions.$inferInsert, 'text' | 'editedAt'>,
  ): Promise<DecisionRow | null> {
    const [row] = await db
      .update(decisions)
      .set(patch)
      .where(and(eq(decisions.id, id), eq(decisions.userId, userId)))
      .returning();
    return row ?? null;
  },

  async deleteForUser(userId: string, id: string): Promise<boolean> {
    const deleted = await db
      .delete(decisions)
      .where(and(eq(decisions.id, id), eq(decisions.userId, userId)))
      .returning({ id: decisions.id });
    return deleted.length > 0;
  },
};
