import { z } from 'zod';

export const ACTION_ITEM_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type ActionItemStatus = (typeof ACTION_ITEM_STATUSES)[number];

/** Who created an item: the AI, or the user by hand (Phase 4). Re-analysis only replaces 'ai'. */
export const ITEM_ORIGINS = ['ai', 'manual'] as const;
export type ItemOrigin = (typeof ITEM_ORIGINS)[number];

export const decisionSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  /** Transcript line it came from, or null if the AI's citation couldn't be verified. */
  sourceLine: z.number().int().positive().nullable(),
  position: z.number().int().nonnegative(),
  /** When the user last changed the text, or null if it's still as created. */
  editedAt: z.iso.datetime().nullable(),
});
export type Decision = z.infer<typeof decisionSchema>;

export const actionItemSchema = z.object({
  id: z.uuid(),
  meetingId: z.uuid(),
  text: z.string(),
  /** A person named in the meeting (free text, not a user account), or null if nobody was. */
  owner: z.string().nullable(),
  /** Resolved calendar date, or null if none was said or it couldn't be worked out. */
  dueDate: z.iso.date().nullable(),
  /** The exact words from the transcript, e.g. "next Friday". */
  dueDateText: z.string().nullable(),
  status: z.enum(ACTION_ITEM_STATUSES),
  /** True when our own checks found something the user should look at. */
  needsReview: z.boolean(),
  reviewReason: z.string().nullable(),
  sourceLine: z.number().int().positive().nullable(),
  sourceQuote: z.string().nullable(),
  /** Short paraphrase of the action's context; older items may not have one yet. */
  contextSummary: z.string().nullable().optional(),
  /** Already added to the user's Google Calendar (adding again updates that event). */
  inCalendar: z.boolean(),
  origin: z.enum(ITEM_ORIGINS),
  position: z.number().int().nonnegative(),
  /** When the user last changed the text, owner or due date, or null if never. */
  editedAt: z.iso.datetime().nullable(),
});
export type ActionItem = z.infer<typeof actionItemSchema>;

// ---------------------------------------------------------------------------------------------
// Editing (Phase 4)
// ---------------------------------------------------------------------------------------------

const itemText = z
  .string()
  .trim()
  .min(1, 'Describe the action item')
  .max(500, 'Use 500 characters or fewer');

// "" from an empty input means "nobody" / "no date".
const ownerInput = z
  .string()
  .trim()
  .max(100, 'Use 100 characters or fewer')
  .nullable()
  .transform((value) => value || null);

const dueDateInput = z
  .union([z.literal(''), z.iso.date('Pick a valid date')])
  .nullable()
  .transform((value) => value || null);

/**
 * The transcript line a hand-made item came from (picked by selecting text on the meeting page).
 * The server checks it exists in that meeting's transcript.
 */
const sourceLineInput = z.number().int().positive().nullable().default(null);

export const createActionItemSchema = z.object({
  text: itemText,
  owner: ownerInput.default(null),
  dueDate: dueDateInput.default(null),
  status: z.enum(ACTION_ITEM_STATUSES).default('todo'),
  sourceLine: sourceLineInput,
  // The exact words picked on that line; the server checks they really are on it.
  sourceQuote: z.string().trim().min(1).max(1000).nullable().default(null),
});
export type CreateActionItemInput = z.input<typeof createActionItemSchema>;

export const updateActionItemSchema = z
  .object({
    text: itemText,
    owner: ownerInput,
    dueDate: dueDateInput,
    status: z.enum(ACTION_ITEM_STATUSES),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Nothing to update');
export type UpdateActionItemInput = z.input<typeof updateActionItemSchema>;

const decisionText = z
  .string()
  .trim()
  .min(1, 'Describe the decision')
  .max(500, 'Use 500 characters or fewer');

export const createDecisionSchema = z.object({ text: decisionText, sourceLine: sourceLineInput });
export const updateDecisionSchema = z.object({ text: decisionText });
export type CreateDecisionInput = z.input<typeof createDecisionSchema>;
export type DecisionInput = z.infer<typeof updateDecisionSchema>;

export const actionItemResponseSchema = z.object({ actionItem: actionItemSchema });

// ---------------------------------------------------------------------------------------------
// Google Calendar (Phase 5)
// ---------------------------------------------------------------------------------------------

export const calendarStatusSchema = z.object({
  /** The server has Google credentials set up at all. */
  available: z.boolean(),
  connected: z.boolean(),
  connectedAt: z.iso.datetime().nullable(),
});
export type CalendarStatus = z.infer<typeof calendarStatusSchema>;

export const addToCalendarResponseSchema = z.object({
  actionItem: actionItemSchema,
  /** Link that opens the event in Google Calendar. */
  eventUrl: z.url(),
});
export const decisionResponseSchema = z.object({ decision: decisionSchema });

// ---------------------------------------------------------------------------------------------
// "My open items" across all meetings
// ---------------------------------------------------------------------------------------------

/** Owner filter value meaning "items with no owner". Not a name anyone will have. */
export const UNASSIGNED_OWNER = '__unassigned';

export const ACTION_ITEM_STATUS_FILTERS = ['open', ...ACTION_ITEM_STATUSES, 'all'] as const;
export type ActionItemStatusFilter = (typeof ACTION_ITEM_STATUS_FILTERS)[number];

export const actionItemsQuerySchema = z.object({
  // 'open' = to do + in progress: the default view of "My open items".
  status: z.enum(ACTION_ITEM_STATUS_FILTERS).default('open'),
  owner: z.string().trim().min(1).max(100).optional(),
  overdue: z.enum(['true', 'false']).optional(),
  // The user's own "today" (their time zone), so "overdue" flips at their midnight, not UTC's.
  today: z.iso.date().optional(),
});
export type ActionItemsQuery = z.input<typeof actionItemsQuerySchema>;

export const actionItemWithMeetingSchema = actionItemSchema.extend({
  meetingTitle: z.string(),
  meetingDate: z.iso.date(),
});
export type ActionItemWithMeeting = z.infer<typeof actionItemWithMeetingSchema>;

export const actionItemListResponseSchema = z.object({
  actionItems: z.array(actionItemWithMeetingSchema),
  /** Every owner name across the user's items, for the filter dropdown. */
  owners: z.array(z.string()),
});
