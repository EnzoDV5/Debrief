import { z } from 'zod';
import { actionItemSchema, decisionSchema } from './analysis';

// ---------- Transcript ----------

/** One numbered line of a parsed transcript. `n` starts at 1 and is what the AI cites later. */
export const transcriptLineSchema = z.object({
  n: z.number().int().positive(),
  speaker: z.string().optional(),
  text: z.string(),
});
export type TranscriptLine = z.infer<typeof transcriptLineSchema>;

export const SOURCE_TYPES = ['paste', 'txt', 'vtt', 'md'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/** File types that can be uploaded (paste is the fourth source type). */
export const UPLOAD_EXTENSIONS = ['txt', 'vtt', 'md'] as const;

export const MAX_TRANSCRIPT_BYTES = 1024 * 1024; // 1 MB

/**
 * UTF-8 size, the same measure as an uploaded file, so paste and upload share one limit.
 * Counted by hand (1–4 bytes per character) so this package needs no browser or Node APIs.
 */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

export const ANALYSIS_STATUSES = ['pending', 'processing', 'done', 'failed'] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

// ---------- Requests ----------

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Give the meeting a title')
  .max(200, 'Use 200 characters or fewer');

// A calendar date (YYYY-MM-DD), not a timestamp: meetings happen on a day, in no time zone.
const meetingDateSchema = z.iso.date('Pick the date of the meeting');

/** Fields sent with an uploaded file (multipart form fields are always strings). */
export const meetingDetailsSchema = z.object({
  title: titleSchema,
  meetingDate: meetingDateSchema,
});
export type MeetingDetailsInput = z.infer<typeof meetingDetailsSchema>;

/** Creating a meeting from pasted text. */
export const createMeetingFromTextSchema = meetingDetailsSchema.extend({
  transcript: z
    .string()
    .refine((text) => text.trim().length > 0, 'Paste the transcript text')
    .refine(
      (text) => utf8ByteLength(text) <= MAX_TRANSCRIPT_BYTES,
      'Transcript is larger than 1 MB',
    ),
});
export type CreateMeetingFromTextInput = z.infer<typeof createMeetingFromTextSchema>;

export const updateMeetingSchema = z
  .object({
    title: titleSchema,
    meetingDate: meetingDateSchema,
    // The AI's summary, as corrected by the user.
    summary: z
      .string()
      .trim()
      .min(1, 'The summary can’t be empty')
      .max(5000, 'Use 5000 characters or fewer'),
    pinned: z.boolean(),
    archived: z.boolean(),
    projectId: z.uuid().nullable(),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Nothing to update');
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;

// ---------- Responses ----------

/** What the meetings list needs: no transcript text, just its size. */
export const meetingListItemSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  meetingDate: z.iso.date(),
  sourceType: z.enum(SOURCE_TYPES),
  analysisStatus: z.enum(ANALYSIS_STATUSES),
  lineCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  pinnedAt: z.iso.datetime().nullable(),
  archivedAt: z.iso.datetime().nullable(),
  projectId: z.uuid().nullable(),
});
export type MeetingListItem = z.infer<typeof meetingListItemSchema>;

export const meetingListResponseSchema = z.object({ meetings: z.array(meetingListItemSchema) });

export const meetingSchema = meetingListItemSchema.extend({
  transcriptLines: z.array(transcriptLineSchema),
  summary: z.string().nullable(),
  analysisError: z.string().nullable(),
  decisions: z.array(decisionSchema),
  actionItems: z.array(actionItemSchema),
  updatedAt: z.iso.datetime(),
});
export type Meeting = z.infer<typeof meetingSchema>;

export const meetingResponseSchema = z.object({ meeting: meetingSchema });

export const projectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime(),
});
export type Project = z.infer<typeof projectSchema>;
export const projectsResponseSchema = z.object({ projects: z.array(projectSchema) });
export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Give the project a name').max(80, 'Use 80 characters or fewer'),
});
export const updateProjectSchema = createProjectSchema;
export const projectResponseSchema = z.object({ project: projectSchema });
