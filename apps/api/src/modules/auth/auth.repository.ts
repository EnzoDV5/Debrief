import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { calendarConnections, sessions, users, type UserRow } from '../../db/schema';

// The only file in the auth module that talks to the database.
// "Active" user = not soft-deleted. Deleted users are invisible to every query here.

const PG_UNIQUE_VIOLATION = '23505';

// Drizzle wraps driver errors, so the Postgres error code may be on the error or its cause.
function isUniqueViolation(err: unknown): boolean {
  const codeOf = (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined;
  const cause = typeof err === 'object' && err !== null && 'cause' in err ? err.cause : undefined;
  return codeOf(err) === PG_UNIQUE_VIOLATION || codeOf(cause) === PG_UNIQUE_VIOLATION;
}

export const authRepository = {
  async findActiveUserByEmail(email: string): Promise<UserRow | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    return user ?? null;
  },

  async findActiveUserById(userId: string): Promise<UserRow | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);
    return user ?? null;
  },

  /** Returns null if an active account already uses this email (unique index). */
  async createUser(data: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<UserRow | null> {
    try {
      const [user] = await db.insert(users).values(data).returning();
      return user ?? null;
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  },

  async createSession(data: { id: string; userId: string; expiresAt: Date }): Promise<void> {
    await db.insert(sessions).values(data);
  },

  /** The user behind a session, if the session exists, hasn't expired and the user is active. */
  async findUserBySession(tokenHash: string): Promise<UserRow | null> {
    const [row] = await db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.id, tokenHash),
          gt(sessions.expiresAt, new Date()),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    return row?.user ?? null;
  },

  async deleteSession(tokenHash: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, tokenHash));
  },

  /** Soft delete + sign out everywhere + forget the calendar link, in one transaction. */
  async softDeleteUser(userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ deletedAt: new Date() })
        .where(and(eq(users.id, userId), isNull(users.deletedAt)));
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      // The stored Google token is useless to a deleted account and must not linger.
      await tx.delete(calendarConnections).where(eq(calendarConnections.userId, userId));
    });
  },
};
