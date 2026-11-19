import { z } from 'zod';

// Shape of GET /api/health. The api uses the type; the web validates the response with the schema.
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
