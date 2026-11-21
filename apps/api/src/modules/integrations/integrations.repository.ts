// Stores each user's calendar connection (the refresh token is encrypted).
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { actionItems, calendarConnections, meetings } from '../../db/schema';

export const integrationsRepository = {
  async findConnection(userId: string) {
    const [row] = await db
      .select()
      .from(calendarConnections)
      .where(eq(calendarConnections.userId, userId))
      .limit(1);
    return row ?? null;
  },

  async saveConnection(userId: string, refreshTokenEncrypted: string, scope: string) {
    await db
      .insert(calendarConnections)
      .values({ userId, refreshTokenEncrypted, scope })
      .onConflictDoUpdate({
        target: calendarConnections.userId,
        set: { refreshTokenEncrypted, scope, createdAt: new Date() },
      });
  },

  async deleteConnection(userId: string) {
    await db.delete(calendarConnections).where(eq(calendarConnections.userId, userId));
  },

  async findItemWithMeeting(userId: string, itemId: string) {
    const [row] = await db
      .select({
        item: actionItems,
        meetingTitle: meetings.title,
        meetingDate: meetings.meetingDate,
      })
      .from(actionItems)
      .innerJoin(meetings, and(eq(meetings.id, actionItems.meetingId), eq(meetings.userId, userId)))
      .where(and(eq(actionItems.id, itemId), eq(actionItems.userId, userId)))
      .limit(1);
    return row ?? null;
  },

  async setCalendarEventId(userId: string, itemId: string, eventId: string) {
    const [row] = await db
      .update(actionItems)
      .set({ calendarEventId: eventId })
      .where(and(eq(actionItems.id, itemId), eq(actionItems.userId, userId)))
      .returning();
    return row ?? null;
  },
};
