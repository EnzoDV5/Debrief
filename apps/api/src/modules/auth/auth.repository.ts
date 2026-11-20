import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  calendarConnections,
  passwordResets,
  sessions,
  users,
  type UserRow,
} from '../../db/schema';

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

  async findActiveUserByGoogleSub(googleSub: string): Promise<UserRow | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.googleSub, googleSub), isNull(users.deletedAt)))
      .limit(1);
    return user ?? null;
  },

  /**
   * Returns null if an active account already uses this email or Google account (unique
   * indexes). Accounts made with Google have no password hash.
   */
  async createUser(data: {
    email: string;
    name: string;
    passwordHash: string | null;
    googleSub?: string;
  }): Promise<UserRow | null> {
    try {
      const [user] = await db.insert(users).values(data).returning();
      return user ?? null;
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  },

  /** Remembers the Google account on an existing user, so next time they're found by it. */
  async linkGoogleAccount(userId: string, googleSub: string): Promise<UserRow | null> {
    const [user] = await db
      .update(users)
      .set({ googleSub })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning();
    return user ?? null;
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

  /** A new "forgot password" link for this user. Any older link of theirs stops working. */
  async replacePasswordReset(data: { id: string; userId: string; expiresAt: Date }) {
    await db.transaction(async (tx) => {
      await tx.delete(passwordResets).where(eq(passwordResets.userId, data.userId));
      await tx.insert(passwordResets).values(data);
    });
  },

  /**
   * Uses a reset link: sets the new password and signs the user out everywhere, in one
   * transaction. Returns null if the link doesn't exist, has expired, was already used, or
   * belongs to a deleted account.
   * Claiming the link is a single UPDATE ... WHERE used_at IS NULL, so even two clicks at the
   * same moment can't both use it.
   */
  async usePasswordReset(tokenHash: string, passwordHash: string): Promise<UserRow | null> {
    return db.transaction(async (tx) => {
      const [claimed] = await tx
        .update(passwordResets)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResets.id, tokenHash),
            isNull(passwordResets.usedAt),
            gt(passwordResets.expiresAt, new Date()),
          ),
        )
        .returning({ userId: passwordResets.userId });
      if (!claimed) return null;

      const [user] = await tx
        .update(users)
        .set({ passwordHash })
        .where(and(eq(users.id, claimed.userId), isNull(users.deletedAt)))
        .returning();
      if (!user) return null;

      // Whoever knew the old password (maybe not the owner) is logged out on every device.
      await tx.delete(sessions).where(eq(sessions.userId, user.id));
      return user;
    });
  },

  /** Soft delete + sign out everywhere + forget the calendar link, in one transaction. */
  async softDeleteUser(userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ deletedAt: new Date() })
        .where(and(eq(users.id, userId), isNull(users.deletedAt)));
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      await tx.delete(passwordResets).where(eq(passwordResets.userId, userId));
      // The stored Google token is useless to a deleted account and must not linger.
      await tx.delete(calendarConnections).where(eq(calendarConnections.userId, userId));
    });
  },
};
