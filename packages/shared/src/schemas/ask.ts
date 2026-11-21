// Schemas for asking a question about a meeting.
import { z } from 'zod';

export const askMeetingInputSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, 'Ask a longer question')
    .max(500, 'Use 500 characters or fewer'),
});
export type AskMeetingInput = z.infer<typeof askMeetingInputSchema>;

export const askMeetingResponseSchema = z
  .object({
    answer: z.string().min(1).max(1200).nullable(),
    citations: z.array(z.number().int().positive()).max(4),
  })
  .refine((result) => (result.answer === null) === (result.citations.length === 0));
export type AskMeetingResponse = z.infer<typeof askMeetingResponseSchema>;
