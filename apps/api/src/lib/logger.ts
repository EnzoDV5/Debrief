import { pino } from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  // Never write session cookies or auth headers to the logs.
  redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
  // Human-readable logs locally; plain JSON everywhere else (what log tools expect).
  transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
});
