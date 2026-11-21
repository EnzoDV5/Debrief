// The app's logger. Cookies and auth headers are never written to the logs.
import { pino } from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
  transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
});
