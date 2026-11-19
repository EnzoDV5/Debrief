import { MAX_TRANSCRIPT_BYTES } from '@debrief/shared';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../lib/errors';

// In memory, not on disk: transcripts are small (≤ 1 MB) and we only need the text.
// multer stops reading as soon as the file passes the size limit, so a huge upload can't fill RAM.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TRANSCRIPT_BYTES, files: 1, fields: 10, fieldSize: 10_000 },
});

/**
 * Accepts one optional file in the "file" field of a multipart form (title and meetingDate come
 * as normal form fields). Requests that aren't multipart (JSON paste) pass straight through.
 * multer's errors are turned into our error shape, attached to the `file` field.
 */
export const transcriptUpload: RequestHandler = (req, res, next) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const message = 'File is larger than 1 MB';
        return next(new AppError(413, 'FILE_TOO_LARGE', message, { file: message }));
      }
      const message = 'Upload one .txt, .vtt or .md file';
      return next(new AppError(400, 'INVALID_UPLOAD', message, { file: message }));
    }
    next(err);
  });
};
