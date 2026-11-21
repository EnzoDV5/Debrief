// Turns any error into our one error shape: { error: { code, message, fields? } }. No stack traces.
import type { ApiErrorBody } from '@debrief/shared';
import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';

function sendError(res: Response, status: number, body: ApiErrorBody['error']) {
  res.status(status).json({ error: body } satisfies ApiErrorBody);
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  sendError(res, 404, { code: 'NOT_FOUND', message: 'Route not found' });
};

function bodyParserErrorType(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string') {
    return err.type;
  }
  return undefined;
}

function fieldErrors(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_root';
    fields[key] ??= issue.message;
  }
  return fields;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    sendError(res, err.status, { code: err.code, message: err.message, fields: err.fields });
    return;
  }

  if (err instanceof ZodError) {
    sendError(res, 400, {
      code: 'VALIDATION_ERROR',
      message: 'Some fields need attention',
      fields: fieldErrors(err),
    });
    return;
  }

  const type = bodyParserErrorType(err);
  if (type === 'entity.parse.failed') {
    sendError(res, 400, { code: 'INVALID_JSON', message: 'Request body is not valid JSON' });
    return;
  }
  if (type === 'entity.too.large') {
    sendError(res, 413, { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' });
    return;
  }

  req.log.error({ err }, 'Unhandled error');
  sendError(res, 500, { code: 'INTERNAL_ERROR', message: 'Something went wrong' });
};
