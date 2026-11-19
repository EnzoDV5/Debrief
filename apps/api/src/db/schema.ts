import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// Tables are added in the phase that needs them; each change gets a new migration in ../../drizzle.
// Column names are spelled out in snake_case so the SQL matches CLAUDE.md exactly.

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Always stored lowercase (the service normalises it) so "Alice@x.com" and "alice@x.com" match.
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Soft delete: the row stays (for history and integrity) but the account can't be used.
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // Unique only among active accounts, so a deleted user's email can register again.
    uniqueIndex('users_email_active_unique')
      .on(t.email)
      .where(sql`${t.deletedAt} is null`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    // SHA-256 hash of the cookie token. The raw token only ever exists in the user's cookie,
    // so a database leak doesn't hand out working sessions.
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
);

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
