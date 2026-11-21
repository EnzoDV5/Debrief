// Schemas for decisions, action items and editing them.
import { z } from 'zod';

export const ACTION_ITEM_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type ActionItemStatus = (typeof ACTION_ITEM_STATUSES)[number];

export const ITEM_ORIGINS = ['ai', 'manual'] as const;
export type ItemOrigin = (typeof ITEM_ORIGINS)[number];

export const decisionSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  sourceLine: z.number().int().positive().nullable(),
  position: z.number().int().nonnegative(),
  editedAt: z.iso.datetime().nullable(),
});
export type Decision = z.infer<typeof decisionSchema>;

export const actionItemSchema = z.object({
  id: z.uuid(),
  meetingId: z.uuid(),
  text: z.string(),
  owner: z.string().nullable(),
  dueDate: z.iso.date().nullable(),
  dueDateText: z.string().nullable(),
  status: z.enum(ACTION_ITEM_STATUSES),
  needsReview: z.boolean(),
  reviewReason: z.string().nullable(),
  sourceLine: z.number().int().positive().nullable(),
  sourceQuote: z.string().nullable(),
  contextSummary: z.string().nullable().optional(),
  inCalendar: z.boolean(),
  origin: z.enum(ITEM_ORIGINS),
  position: z.number().int().nonnegative(),
  editedAt: z.iso.datetime().nullable(),
});
export type ActionItem = z.infer<typeof actionItemSchema>;

const itemText = z
  .string()
  .trim()
  .min(1, 'Describe the action item')
  .max(500, 'Use 500 characters or fewer');

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

const sourceLineInput = z.number().int().positive().nullable().default(null);

export const createActionItemSchema = z.object({
  text: itemText,
  owner: ownerInput.default(null),
  dueDate: dueDateInput.default(null),
  status: z.enum(ACTION_ITEM_STATUSES).default('todo'),
  sourceLine: sourceLineInput,
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

export const calendarStatusSchema = z.object({
  available: z.boolean(),
  connected: z.boolean(),
  connectedAt: z.iso.datetime().nullable(),
});
export type CalendarStatus = z.infer<typeof calendarStatusSchema>;

export const addToCalendarResponseSchema = z.object({
  actionItem: actionItemSchema,
  eventUrl: z.url(),
});
export const decisionResponseSchema = z.object({ decision: decisionSchema });

export const UNASSIGNED_OWNER = '__unassigned';

export const ACTION_ITEM_STATUS_FILTERS = ['open', ...ACTION_ITEM_STATUSES, 'all'] as const;
export type ActionItemStatusFilter = (typeof ACTION_ITEM_STATUS_FILTERS)[number];

export const actionItemsQuerySchema = z.object({
  status: z.enum(ACTION_ITEM_STATUS_FILTERS).default('open'),
  owner: z.string().trim().min(1).max(100).optional(),
  overdue: z.enum(['true', 'false']).optional(),
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
  owners: z.array(z.string()),
});
