// All the database work for projects. Every query is filtered by the logged-in user.
import { and, asc, count, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { meetings, projects } from '../../db/schema';

export const projectsRepository = {
  list(userId: string) {
    return db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(asc(projects.name));
  },
  meetingCounts(userId: string) {
    return db
      .select({ projectId: meetings.projectId, meetingCount: count() })
      .from(meetings)
      .where(
        and(
          eq(meetings.userId, userId),
          isNotNull(meetings.projectId),
          isNull(meetings.archivedAt),
        ),
      )
      .groupBy(meetings.projectId);
  },
  async create(userId: string, name: string) {
    const [row] = await db.insert(projects).values({ userId, name }).returning();
    return row!;
  },
  async update(userId: string, id: string, name: string) {
    const [row] = await db
      .update(projects)
      .set({ name })
      .where(and(eq(projects.userId, userId), eq(projects.id, id)))
      .returning();
    return row ?? null;
  },
  async remove(userId: string, id: string) {
    const rows = await db
      .delete(projects)
      .where(and(eq(projects.userId, userId), eq(projects.id, id)))
      .returning({ id: projects.id });
    return rows.length > 0;
  },
};
