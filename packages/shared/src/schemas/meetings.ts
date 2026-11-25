// Schemas for meetings, transcripts and projects.
import { z } from 'zod';
import { actionItemSchema, decisionSchema } from './analysis';

export const transcriptLineSchema = z.object({
  n: z.number().int().positive(),
  speaker: z.string().optional(),
  text: z.string(),
  edited: z.boolean().optional(),
  // True when the user said who spoke this line (not from the original transcript).
  speakerEdited: z.boolean().optional(),
});
export type TranscriptLine = z.infer<typeof transcriptLineSchema>;

export const SOURCE_TYPES = ['paste', 'txt', 'vtt', 'md'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const UPLOAD_EXTENSIONS = ['txt', 'vtt', 'md'] as const;

export const MAX_TRANSCRIPT_BYTES = 1024 * 1024;

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

// Queued or running. While true, the meeting can't be archived (web and api both check this).
export const ANALYSING_STATUSES = ['pending', 'processing'] as const satisfies AnalysisStatus[];
export const isAnalysing = (status: AnalysisStatus) =>
  (ANALYSING_STATUSES as readonly AnalysisStatus[]).includes(status);
export const ARCHIVE_WHILE_ANALYSING_MESSAGE =
  'You can archive this meeting once the analysis finishes';
// Renaming edits the title and the meeting date, and the date is what "next Friday" is resolved against.
export const RENAME_WHILE_ANALYSING_MESSAGE =
  'You can rename this meeting once the analysis finishes';
// The AI is reading the transcript right now: an edited line could leave its quotes pointing at
// words that are no longer there, so the transcript and new notes wait until it's done.
export const EDIT_WHILE_ANALYSING_MESSAGE = 'You can add or edit once the analysis finishes';

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Give the meeting a title')
  .max(200, 'Use 200 characters or fewer');

const meetingDateSchema = z.iso.date('Pick the date of the meeting');

export const meetingDetailsSchema = z.object({
  title: titleSchema,
  meetingDate: meetingDateSchema,
});
export type MeetingDetailsInput = z.infer<typeof meetingDetailsSchema>;

export const updateMeetingSchema = z
  .object({
    title: titleSchema,
    meetingDate: meetingDateSchema,
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

export const archiveAllResponseSchema = z.object({ archived: z.number().int().nonnegative() });

// A new sidebar order for one section (pinned or recent): meeting ids, top to bottom.
export const reorderMeetingsSchema = z.object({
  ids: z
    .array(z.uuid())
    .min(1)
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, 'Each meeting can only appear once'),
});
export type ReorderMeetingsInput = z.infer<typeof reorderMeetingsSchema>;

// Fixing a line the transcription got wrong. The original upload is never changed.
export const lineNumberSchema = z.coerce.number().int().positive();
const lineTextSchema = z
  .string()
  .trim()
  .min(1, 'A line can’t be empty')
  .max(2000, 'Use 2000 characters or fewer');
// An empty speaker removes it.
const lineSpeakerSchema = z
  .string()
  .trim()
  .max(100, 'Use 100 characters or fewer')
  .nullable()
  .transform((value) => value || null);
// Fix a line's words, say who spoke it, or both.
export const updateTranscriptLineSchema = z
  .object({ text: lineTextSchema, speaker: lineSpeakerSchema })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Nothing to update');
export type UpdateTranscriptLineInput = z.infer<typeof updateTranscriptLineSchema>;

// The same fixes made on the check step, before the meeting is saved: they're applied before the
// AI reads anything, and flagged on the line just like a fix made later.
export const MAX_LINE_EDITS = 500;
export const lineEditsSchema = z
  .array(
    z
      .object({
        n: z.number().int().positive(),
        text: lineTextSchema.optional(),
        speaker: lineSpeakerSchema.optional(),
      })
      .refine((edit) => edit.text !== undefined || edit.speaker !== undefined, 'Nothing to update'),
  )
  .max(MAX_LINE_EDITS, `Edit ${MAX_LINE_EDITS} lines or fewer before saving`)
  .refine(
    (edits) => new Set(edits.map((edit) => edit.n)).size === edits.length,
    'Each line can only appear once',
  );
export type LineEdit = z.infer<typeof lineEditsSchema>[number];

export const createMeetingFromTextSchema = meetingDetailsSchema.extend({
  transcript: z
    .string()
    .refine((text) => text.trim().length > 0, 'Paste the transcript text')
    .refine(
      (text) => utf8ByteLength(text) <= MAX_TRANSCRIPT_BYTES,
      'Transcript is larger than 1 MB',
    ),
  lineEdits: lineEditsSchema.optional(),
});
export type CreateMeetingFromTextInput = z.infer<typeof createMeetingFromTextSchema>;

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
export const projectWithCountSchema = projectSchema.extend({
  meetingCount: z.number().int().nonnegative(),
});
export type ProjectWithCount = z.infer<typeof projectWithCountSchema>;
export const projectsResponseSchema = z.object({ projects: z.array(projectWithCountSchema) });
export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Give the project a name').max(80, 'Use 80 characters or fewer'),
});
export const updateProjectSchema = createProjectSchema;
export const projectResponseSchema = z.object({ project: projectSchema });
