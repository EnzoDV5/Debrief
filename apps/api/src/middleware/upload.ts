// Accepts one file upload in memory: a transcript (capped at 1 MB) or a profile photo (512 KB).
import { MAX_AVATAR_BYTES, MAX_TRANSCRIPT_BYTES } from '@debrief/shared';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { AppError } from '../lib/errors';

// fieldSize leaves room for the line edits made on the check step (up to 500 lines, as JSON).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TRANSCRIPT_BYTES, files: 1, fields: 10, fieldSize: 2 * 1024 * 1024 },
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

const avatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1, fields: 0 },
});

export const avatarUpload: RequestHandler = (req, res, next) => {
  avatar.single('file')(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const message = 'Photo is larger than 512 KB';
        return next(new AppError(413, 'FILE_TOO_LARGE', message, { file: message }));
      }
      const message = 'Upload one JPEG, PNG or WebP photo';
      return next(new AppError(400, 'INVALID_UPLOAD', message, { file: message }));
    }
    next(err);
  });
};
