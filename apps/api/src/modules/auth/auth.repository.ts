// All the database work for users and sessions. Soft-deleted users are invisible here.
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  calendarConnections,
  passwordResets,
  sessions,
  userAvatars,
  users,
  type UserRow,
} from '../../db/schema';

const PG_UNIQUE_VIOLATION = '23505';

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

  async createUser(data: {
    email: string;
    name: string;
    passwordHash: string | null;
    googleSub?: string;
    googleAvatarUrl?: string | null;
  }): Promise<UserRow | null> {
    try {
      const [user] = await db.insert(users).values(data).returning();
      return user ?? null;
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  },

  async updateName(userId: string, name: string): Promise<UserRow | null> {
    const [user] = await db
      .update(users)
      .set({ name })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning();
    return user ?? null;
  },

  async linkGoogleAccount(
    userId: string,
    googleSub: string,
    googleAvatarUrl: string | null,
  ): Promise<UserRow | null> {
    const [user] = await db
      .update(users)
      .set({ googleSub, googleAvatarUrl })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning();
    return user ?? null;
  },

  async updateGoogleAvatarUrl(
    userId: string,
    googleAvatarUrl: string | null,
  ): Promise<UserRow | null> {
    const [user] = await db
      .update(users)
      .set({ googleAvatarUrl })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning();
    return user ?? null;
  },

  async saveUploadedAvatar(
    userId: string,
    contentType: string,
    data: Buffer,
  ): Promise<UserRow | null> {
    return db.transaction(async (tx) => {
      const [user] = await tx
        .update(users)
        .set({ avatarUpdatedAt: new Date() })
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .returning();
      if (!user) return null;
      await tx
        .insert(userAvatars)
        .values({ userId, contentType, data })
        .onConflictDoUpdate({
          target: userAvatars.userId,
          set: { contentType, data, createdAt: new Date() },
        });
      return user;
    });
  },

  async findUploadedAvatar(userId: string): Promise<{ contentType: string; data: Buffer } | null> {
    const [avatar] = await db
      .select({ contentType: userAvatars.contentType, data: userAvatars.data })
      .from(userAvatars)
      .innerJoin(users, eq(users.id, userAvatars.userId))
      .where(and(eq(userAvatars.userId, userId), isNull(users.deletedAt)))
      .limit(1);
    return avatar ?? null;
  },

  async removeUploadedAvatar(userId: string): Promise<UserRow | null> {
    return db.transaction(async (tx) => {
      await tx.delete(userAvatars).where(eq(userAvatars.userId, userId));
      const [user] = await tx
        .update(users)
        .set({ avatarUpdatedAt: null })
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .returning();
      return user ?? null;
    });
  },

  async createSession(data: { id: string; userId: string; expiresAt: Date }): Promise<void> {
    await db.insert(sessions).values(data);
  },

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

  async replacePasswordReset(data: { id: string; userId: string; expiresAt: Date }) {
    await db.transaction(async (tx) => {
      await tx.delete(passwordResets).where(eq(passwordResets.userId, data.userId));
      await tx.insert(passwordResets).values(data);
    });
  },

  // The current password behind a reset link that can still be used, without using it up.
  // `found: false` means the link is expired, used or unknown; `passwordHash` is null for an
  // account that has only ever signed in with Google.
  async findPasswordForReset(
    tokenHash: string,
  ): Promise<{ found: false } | { found: true; passwordHash: string | null }> {
    const [row] = await db
      .select({ passwordHash: users.passwordHash })
      .from(passwordResets)
      .innerJoin(users, eq(passwordResets.userId, users.id))
      .where(
        and(
          eq(passwordResets.id, tokenHash),
          isNull(passwordResets.usedAt),
          gt(passwordResets.expiresAt, new Date()),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    return row ? { found: true, passwordHash: row.passwordHash } : { found: false };
  },

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

      await tx.delete(sessions).where(eq(sessions.userId, user.id));
      return user;
    });
  },

  async softDeleteUser(userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ deletedAt: new Date(), googleAvatarUrl: null, avatarUpdatedAt: null })
        .where(and(eq(users.id, userId), isNull(users.deletedAt)));
      await tx.delete(sessions).where(eq(sessions.userId, userId));
      await tx.delete(passwordResets).where(eq(passwordResets.userId, userId));
      await tx.delete(calendarConnections).where(eq(calendarConnections.userId, userId));
      await tx.delete(userAvatars).where(eq(userAvatars.userId, userId));
    });
  },
};
