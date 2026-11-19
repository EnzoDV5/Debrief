import type { Request } from 'express';
import { z } from 'zod';
import { notFound } from './errors';

/**
 * Reads a UUID route parameter. A malformed id gets the same 404 as someone else's record, so
 * a response never reveals whether an id exists (ids can't be probed).
 */
export function uuidParam(req: Request, name: string, what: string): string {
  const result = z.uuid().safeParse(req.params[name]);
  if (!result.success) throw notFound(what);
  return result.data;
}
