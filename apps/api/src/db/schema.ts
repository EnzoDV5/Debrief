// Every table in the database, described for Drizzle.
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

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash'),
    googleSub: text('google_sub'),
    name: text('name').notNull(),
    ...timestamps,
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('users_email_active_unique')
      .on(t.email)
      .where(sql`${t.deletedAt} is null`),
    uniqueIndex('users_google_sub_active_unique')
      .on(t.googleSub)
      .where(sql`${t.deletedAt} is null and ${t.googleSub} is not null`),
  ],
).enableRLS();

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
).enableRLS();

export const passwordResets = pgTable(
  'password_resets',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('password_resets_user_id_idx').on(t.userId)],
).enableRLS();

export const sourceTypeEnum = pgEnum('meeting_source_type', SOURCE_TYPES);
export const analysisStatusEnum = pgEnum('analysis_status', ANALYSIS_STATUSES);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    ...timestamps,
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('projects_user_id_name_unique').on(t.userId, sql`lower(${t.name})`)],
).enableRLS();

export const meetings = pgTable(
  'meetings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    meetingDate: date('meeting_date', { mode: 'string' }).notNull(),
    transcriptOriginal: text('transcript_original').notNull(),
    transcriptLines: jsonb('transcript_lines').$type<TranscriptLine[]>().notNull(),
    sourceType: sourceTypeEnum('source_type').notNull(),
    pinnedAt: timestamp('pinned_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    summary: text('summary'),
    analysisStatus: analysisStatusEnum('analysis_status').notNull().default('pending'),
    analysisError: text('analysis_error'),
    ...timestamps,
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('meetings_user_id_created_at_idx').on(t.userId, t.createdAt),
    index('meetings_user_id_project_id_idx').on(t.userId, t.projectId),
  ],
).enableRLS();

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
    position: integer('position').notNull(),
    origin: itemOriginEnum('origin').notNull().default('ai'),
    editedAt: timestamp('edited_at', { withTimezone: true }),
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
    owner: text('owner'),
    dueDate: date('due_date', { mode: 'string' }),
    dueDateText: text('due_date_text'),
    status: actionItemStatusEnum('status').notNull().default('todo'),
    needsReview: boolean('needs_review').notNull().default(false),
    reviewReason: text('review_reason'),
    sourceLine: integer('source_line'),
    sourceQuote: text('source_quote'),
    contextSummary: text('context_summary'),
    calendarEventId: text('calendar_event_id'),
    origin: itemOriginEnum('origin').notNull(),
    position: integer('position').notNull(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    ...timestamps,
    updatedAt,
  },
  (t) => [
    index('action_items_meeting_id_idx').on(t.meetingId),
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

export const analysisRuns = pgTable(
  'analysis_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...ownedByMeeting,
    step: analysisStepEnum('step').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    status: analysisRunStatusEnum('status').notNull(),
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
export type ProjectRow = typeof projects.$inferSelect;
export type DecisionRow = typeof decisions.$inferSelect;
export type ActionItemRow = typeof actionItems.$inferSelect;

export const calendarConnections = pgTable('calendar_connections', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('google'),
  refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
  scope: text('scope').notNull(),
  ...timestamps,
}).enableRLS();
