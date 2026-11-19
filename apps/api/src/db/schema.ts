import {
  ACTION_ITEM_STATUSES,
  ANALYSIS_STATUSES,
  ITEM_ORIGINS,
  SOURCE_TYPES,
  type TranscriptLine,
} from '@debrief/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
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

// ---------------------------------------------------------------------------------------------
// Analysis results (Phase 3). Each row repeats user_id so every query can filter by owner
// directly, the same isolation rule as meetings.
// ---------------------------------------------------------------------------------------------

const updatedAt = timestamp('updated_at', { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date());

const ownedByMeeting = {
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
};

export const itemOriginEnum = pgEnum('item_origin', ITEM_ORIGINS);
export const actionItemStatusEnum = pgEnum('action_item_status', ACTION_ITEM_STATUSES);

export const decisions = pgTable(
  'decisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownedByMeeting,
    text: text('text').notNull(),
    sourceLine: integer('source_line'),
    // Order shown in the UI (the order the AI listed them).
    position: integer('position').notNull(),
    origin: itemOriginEnum('origin').notNull().default('ai'),
    ...timestamps,
    updatedAt,
  },
  (t) => [index('decisions_meeting_id_idx').on(t.meetingId)],
).enableRLS();

export const actionItems = pgTable(
  'action_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownedByMeeting,
    text: text('text').notNull(),
    // A person named in the meeting, not a user account.
    owner: text('owner'),
    // Resolved by our code from due_date_text + the meeting date, never invented by the AI.
    dueDate: date('due_date', { mode: 'string' }),
    dueDateText: text('due_date_text'),
    status: actionItemStatusEnum('status').notNull().default('todo'),
    needsReview: boolean('needs_review').notNull().default(false),
    reviewReason: text('review_reason'),
    sourceLine: integer('source_line'),
    sourceQuote: text('source_quote'),
    // Set once the item is added to Google Calendar, so adding again updates that same event
    // instead of creating a duplicate.
    calendarEventId: text('calendar_event_id'),
    origin: itemOriginEnum('origin').notNull(),
    position: integer('position').notNull(),
    ...timestamps,
    updatedAt,
  },
  (t) => [
    index('action_items_meeting_id_idx').on(t.meetingId),
    // "My open items" (Phase 4) filters by user + status and user + due date.
    index('action_items_user_id_status_idx').on(t.userId, t.status),
    index('action_items_user_id_due_date_idx').on(t.userId, t.dueDate),
  ],
).enableRLS();

export const ANALYSIS_STEPS = ['summary', 'decisions', 'action_items'] as const;
export const analysisStepEnum = pgEnum('analysis_step', ANALYSIS_STEPS);
export const analysisRunStatusEnum = pgEnum('analysis_run_status', [
  'success',
  'invalid_output',
  'failed',
]);

/**
 * One row per AI call attempt: which model, which prompt version, and what happened. This is
 * the audit trail for "why does this meeting show what it shows?" and for comparing models.
 */
export const analysisRuns = pgTable(
  'analysis_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownedByMeeting,
    step: analysisStepEnum('step').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    status: analysisRunStatusEnum('status').notNull(),
    // What the model returned (parsed JSON, or { raw: "..." } when it wasn't JSON).
    rawOutput: jsonb('raw_output'),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('analysis_runs_meeting_id_idx').on(t.meetingId)],
).enableRLS();

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type MeetingRow = typeof meetings.$inferSelect;
export type DecisionRow = typeof decisions.$inferSelect;
export type ActionItemRow = typeof actionItems.$inferSelect;

// ---------------------------------------------------------------------------------------------
// Integrations (Phase 5)
// ---------------------------------------------------------------------------------------------

/**
 * A user's link to their Google Calendar: one row per user. The refresh token lets the server
 * create events later without asking again. It's a powerful credential, so it's stored
 * encrypted (AES-256-GCM, key from ENCRYPTION_KEY), never in plain text, and never sent to the
 * browser.
 */
export const calendarConnections = pgTable('calendar_connections', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('google'),
  refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
  // What Google actually granted (proof we only hold calendar.events).
  scope: text('scope').notNull(),
  ...timestamps,
}).enableRLS();
