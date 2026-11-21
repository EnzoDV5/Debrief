// Accepts one transcript file upload in memory, capped at 1 MB.
import { MAX_TRANSCRIPT_BYTES } from '@debrief/shared';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../lib/errors';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TRANSCRIPT_BYTES, files: 1, fields: 10, fieldSize: 10_000 },
});

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
