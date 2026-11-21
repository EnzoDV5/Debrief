// The analysis worker's database work, always scoped to the meeting's owner.
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { actionItems, analysisRuns, decisions, meetings } from '../../db/schema';
import type { ActionItemDraft, DecisionDraft } from './postChecks';

export const analysisRepository = {
  async findMeeting(userId: string, meetingId: string) {
    const [meeting] = await db
      .select({
        id: meetings.id,
        meetingDate: meetings.meetingDate,
        transcriptLines: meetings.transcriptLines,
      })
      .from(meetings)
      .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)))
      .limit(1);
    return meeting ?? null;
  },

  async markProcessing(userId: string, meetingId: string) {
    await db
      .update(meetings)
      .set({ analysisStatus: 'processing', analysisError: null })
      .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)));
  },

  async markFailed(userId: string, meetingId: string, message: string) {
    await db
      .update(meetings)
      .set({ analysisStatus: 'failed', analysisError: message })
      .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)));
  },

  async recordRun(run: typeof analysisRuns.$inferInsert) {
    await db.insert(analysisRuns).values(run);
  },

  async saveResults(
    userId: string,
    meetingId: string,
    results: { summary: string; decisions: DecisionDraft[]; actionItems: ActionItemDraft[] },
  ) {
    const owned = { meetingId, userId };
    await db.transaction(async (tx) => {
      await tx
        .delete(decisions)
        .where(
          and(
            eq(decisions.meetingId, meetingId),
            eq(decisions.userId, userId),
            eq(decisions.origin, 'ai'),
          ),
        );
      await tx
        .delete(actionItems)
        .where(
          and(
            eq(actionItems.meetingId, meetingId),
            eq(actionItems.userId, userId),
            eq(actionItems.origin, 'ai'),
          ),
        );

      if (results.decisions.length > 0) {
        await tx.insert(decisions).values(
          results.decisions.map((d, position) => ({
            ...owned,
            ...d,
            position,
            origin: 'ai' as const,
          })),
        );
      }
      if (results.actionItems.length > 0) {
        await tx.insert(actionItems).values(
          results.actionItems.map((item, position) => ({
            ...owned,
            ...item,
            position,
            origin: 'ai' as const,
          })),
        );
      }

      await tx
        .update(meetings)
        .set({ summary: results.summary, analysisStatus: 'done', analysisError: null })
        .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)));
    });
  },
};
