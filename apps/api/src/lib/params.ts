// Reads an id from the URL. A bad id gets the same 404 as someone else's, so ids can't be probed.
import type { Request } from 'express';
import { z } from 'zod';
import { notFound } from './errors';

export function uuidParam(req: Request, name: string, what: string): string {
  const result = z.uuid().safeParse(req.params[name]);
  if (!result.success) throw notFound(what);
  return result.data;
}
