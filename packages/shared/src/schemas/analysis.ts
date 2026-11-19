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
  origin: z.enum(ITEM_ORIGINS),
  position: z.number().int().nonnegative(),
});
export type ActionItem = z.infer<typeof actionItemSchema>;
