// Checks an uploaded file is really a .txt, .vtt or .md transcript in valid UTF-8, and reads it.
import { UPLOAD_EXTENSIONS } from '@debrief/shared';
import { AppError } from './errors';

type UploadExtension = (typeof UPLOAD_EXTENSIONS)[number];

const fileError = (code: string, message: string) =>
  new AppError(400, code, message, { file: message });

function extensionOf(filename: string): UploadExtension | undefined {
  const ext = filename.split('.').pop()?.toLowerCase();
  return UPLOAD_EXTENSIONS.find((allowed) => allowed === ext);
}

export function readTranscriptFile(file: { originalname: string; buffer: Buffer }) {
  const sourceType = extensionOf(file.originalname);
  if (!sourceType) throw fileError('UNSUPPORTED_FILE_TYPE', 'Upload a .txt, .vtt or .md file');

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
  } catch {
    throw fileError('INVALID_ENCODING', "This file isn't valid UTF-8 text");
  }
  if (text.includes('\0')) throw fileError('NOT_TEXT', "This file doesn't look like a text file");
  if (text.trim() === '') throw fileError('EMPTY_FILE', 'This file is empty');

  return { text, sourceType };
}
