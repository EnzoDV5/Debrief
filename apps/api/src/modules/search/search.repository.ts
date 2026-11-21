// Searches (or, with no term, lists the latest of) the user's action items and decisions.
// Every query is filtered by userId.
import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { db } from '../../db/client';
import { actionItems, decisions, meetings } from '../../db/schema';

const LIMIT = 8;

// Escape % and _ so they're searched for literally, not as wildcards.
const pattern = (term: string) => `%${term.replace(/[\\%_]/g, '\\$&')}%`;

export const searchRepository = {
  async actionItems(userId: string, term?: string) {
    return db
      .select({
        id: actionItems.id,
        text: actionItems.text,
        owner: actionItems.owner,
        meetingId: actionItems.meetingId,
        meetingTitle: meetings.title,
        sourceLine: actionItems.sourceLine,
      })
      .from(actionItems)
      .innerJoin(meetings, eq(meetings.id, actionItems.meetingId))
      .where(
        and(
          eq(actionItems.userId, userId),
          eq(meetings.userId, userId),
          isNull(meetings.archivedAt),
          term
            ? or(ilike(actionItems.text, pattern(term)), ilike(actionItems.owner, pattern(term)))
            : undefined,
        ),
      )
      .orderBy(desc(actionItems.createdAt))
      .limit(LIMIT);
  },

  async decisions(userId: string, term?: string) {
    return db
      .select({
        id: decisions.id,
        text: decisions.text,
        meetingId: decisions.meetingId,
        meetingTitle: meetings.title,
        sourceLine: decisions.sourceLine,
      })
      .from(decisions)
      .innerJoin(meetings, eq(meetings.id, decisions.meetingId))
      .where(
        and(
          eq(decisions.userId, userId),
          eq(meetings.userId, userId),
          isNull(meetings.archivedAt),
          term ? ilike(decisions.text, pattern(term)) : undefined,
        ),
      )
      .orderBy(desc(decisions.createdAt))
      .limit(LIMIT);
  },
};
