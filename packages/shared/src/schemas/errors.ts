import { z } from 'zod';

// The one error shape every api error uses. `fields` maps a form field to its message so the
// web can show it inline under the right input.
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
