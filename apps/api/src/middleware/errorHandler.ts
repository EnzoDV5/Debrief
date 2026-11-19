import type { ErrorRequestHandler, RequestHandler } from 'express';

// Every error response has the same shape: { error: { code, message, fields? } }.
// The client can always rely on `error.code`, and we never send stack traces.

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
};

// express.json() throws errors with a `type` like 'entity.parse.failed'.
function bodyParserErrorType(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string') {
    return err.type;
  }
  return undefined;
}

// Express only treats a middleware as an error handler if it takes exactly 4 arguments,
// so `_next` must stay even though it's unused.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const type = bodyParserErrorType(err);

  if (type === 'entity.parse.failed') {
    res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
    return;
  }
  if (type === 'entity.too.large') {
    res
      .status(413)
      .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
    return;
  }

  // Unexpected: log the full error (with request id) for us, send a generic message to the client.
  req.log.error({ err }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
};
