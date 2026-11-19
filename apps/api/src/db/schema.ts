import { ANALYSIS_STATUSES, SOURCE_TYPES, type TranscriptLine } from '@debrief/shared';
import { sql } from 'drizzle-orm';
import {
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Tables are added in the phase that needs them; each change gets a new migration in ../../drizzle.
// Column names are spelled out in snake_case so the SQL matches CLAUDE.md exactly.
//
// Every table calls .enableRLS() (Row Level Security) with no policies. Our api connects as the
// table owner, which bypasses RLS, so nothing changes for us. But Supabase's public roles
// (anon/authenticated, used by its auto-generated Data API) can then read nothing, even if the
// Data API is ever switched back on. A test fails if a table is added without it.

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Always stored lowercase (the service normalises it) so "Alice@x.com" and "alice@x.com" match.
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    ...timestamps,
    // Soft delete: the row stays (for history and integrity) but the account can't be used.
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    // Unique only among active accounts, so a deleted user's email can register again.
    uniqueIndex('users_email_active_unique')
      .on(t.email)
      .where(sql`${t.deletedAt} is null`),
  ],
).enableRLS();

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
    ...timestamps,
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
).enableRLS();

// Postgres enums: the database itself rejects any value outside these lists.
export const sourceTypeEnum = pgEnum('meeting_source_type', SOURCE_TYPES);
export const analysisStatusEnum = pgEnum('analysis_status', ANALYSIS_STATUSES);

export const meetings = pgTable(
  'meetings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    // `date`, not a timestamp: a meeting happens on a calendar day. Kept as a 'YYYY-MM-DD'
    // string so no time zone can shift it to the day before.
    meetingDate: date('meeting_date', { mode: 'string' }).notNull(),
    // Exactly what the user pasted or uploaded. Never modified, so we can always re-parse it.
    transcriptOriginal: text('transcript_original').notNull(),
    // The parsed, numbered lines that the UI shows and the AI cites.
    transcriptLines: jsonb('transcript_lines').$type<TranscriptLine[]>().notNull(),
    sourceType: sourceTypeEnum('source_type').notNull(),
    summary: text('summary'),
    analysisStatus: analysisStatusEnum('analysis_status').notNull().default('pending'),
    // A user-friendly message when analysis fails (never a stack trace).
    analysisError: text('analysis_error'),
    ...timestamps,
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  // Matches the list query: "this user's meetings, newest first".
  (t) => [index('meetings_user_id_created_at_idx').on(t.userId, t.createdAt)],
).enableRLS();

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type MeetingRow = typeof meetings.$inferSelect;
