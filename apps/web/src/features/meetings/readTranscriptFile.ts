import {
  MAX_TRANSCRIPT_BYTES,
  parseTranscript,
  UPLOAD_EXTENSIONS,
  type TranscriptLine,
} from '@debrief/shared';

export type ReadFileResult = { ok: true; lines: TranscriptLine[] } | { ok: false; error: string };

/**
 * The browser-side twin of the api's file checks, for instant feedback before uploading.
 * The server repeats every check: this only saves the user a round trip.
 */
export async function readTranscriptFile(file: File): Promise<ReadFileResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const sourceType = UPLOAD_EXTENSIONS.find((allowed) => allowed === ext);
  if (!sourceType) return { ok: false, error: 'Upload a .txt, .vtt or .md file' };
  if (file.size > MAX_TRANSCRIPT_BYTES) return { ok: false, error: 'File is larger than 1 MB' };

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    return { ok: false, error: "This file isn't valid UTF-8 text" };
  }
  if (text.includes('\0')) return { ok: false, error: "This file doesn't look like a text file" };
  if (text.trim() === '') return { ok: false, error: 'This file is empty' };

  const lines = parseTranscript(text, sourceType);
  if (lines.length === 0) return { ok: false, error: 'No readable transcript text was found' };
  return { ok: true, lines };
}

/** "q1-planning_call.vtt" → "Q1 planning call": a sensible default title. */
export function titleFromFilename(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
}
