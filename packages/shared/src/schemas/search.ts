// One search across meetings, action items and decisions (the search pop-up).
import { z } from 'zod';
import { meetingListItemSchema } from './meetings';

// Without q you get the most recent meetings, action items and decisions (used by the filters).
export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100, 'Use 100 characters or fewer')
    .refine((q) => q.length === 0 || q.length >= 2, 'Type at least 2 characters')
    .optional(),
});

const hitBase = {
  id: z.uuid(),
  text: z.string(),
  meetingId: z.uuid(),
  meetingTitle: z.string(),
  sourceLine: z.number().int().nullable(),
};

export const searchResponseSchema = z.object({
  meetings: z.array(meetingListItemSchema),
  actionItems: z.array(z.object({ ...hitBase, owner: z.string().nullable() })),
  decisions: z.array(z.object(hitBase)),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;
