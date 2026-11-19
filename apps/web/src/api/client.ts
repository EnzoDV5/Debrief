import { apiErrorSchema } from '@debrief/shared';
import type { ZodType } from 'zod';

/**
 * Every failed request becomes an ApiError with the server's `code` and per-field messages,
 * so components never have to dig through raw responses.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown };

async function send(path: string, { method = 'GET', body }: RequestOptions): Promise<Response> {
  let res: Response;
  try {
    // Relative /api URL: same origin in dev (Vite proxy), Docker (nginx) and production
    // (Vercel rewrite), so the session cookie is always first-party and sent automatically.
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      "Can't reach the server. Check your connection and try again.",
    );
  }

  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(await res.json().catch(() => null));
    if (parsed.success) {
      const { code, message, fields } = parsed.data.error;
      throw new ApiError(res.status, code, message, fields);
    }
    throw new ApiError(res.status, 'UNKNOWN_ERROR', 'Something went wrong. Please try again.');
  }
  return res;
}

/** Request that returns JSON. The response is checked against `schema`, never trusted blindly. */
export async function request<T>(
  path: string,
  options: RequestOptions & { schema: ZodType<T> },
): Promise<T> {
  const res = await send(path, options);
  const parsed = options.schema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    throw new ApiError(res.status, 'BAD_RESPONSE', 'The server sent an unexpected response.');
  }
  return parsed.data;
}

/** Request that returns no body (204), e.g. logout. */
export async function requestNoContent(path: string, options: RequestOptions): Promise<void> {
  await send(path, options);
}
