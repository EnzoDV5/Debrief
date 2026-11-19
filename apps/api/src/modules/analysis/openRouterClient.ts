// Talks to OpenRouter (an OpenAI-compatible API in front of many models). Only the api server
// ever calls it: the key never reaches the browser.
//
// This file knows about HTTP, timeouts and retries. It knows nothing about meetings: it sends a
// prompt and returns the model's raw text. Validating that text is the analysis service's job.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Why a call failed. The kind decides what happens next:
 * - retried on the same model: rate_limited, unavailable, timeout
 * - try the next model:       rejected, empty (and the above, once retries run out)
 * - stop everything:          daily_limit, auth, not_configured (no other model will help)
 */
export type AiErrorKind =
  | 'daily_limit'
  | 'rate_limited'
  | 'unavailable'
  | 'timeout'
  | 'rejected'
  | 'empty'
  | 'auth'
  | 'not_configured';

export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

const RETRYABLE: ReadonlySet<AiErrorKind> = new Set(['rate_limited', 'unavailable', 'timeout']);
export const FATAL: ReadonlySet<AiErrorKind> = new Set(['daily_limit', 'auth', 'not_configured']);

export type AiRequest = {
  model: string;
  system: string;
  user: string;
  /** Name + JSON Schema for OpenRouter's structured output (response_format: json_schema). */
  schemaName: string;
  jsonSchema: Record<string, unknown>;
};

/** The one thing the analysis service needs from an AI provider. Tests pass a fake. */
export interface AiClient {
  complete(request: AiRequest): Promise<string>;
}

type Options = {
  apiKey: string | undefined;
  appUrl: string;
  timeoutMs: number;
  /** Waits before each retry on the same model. Two retries: ~1s, then ~3s. */
  retryDelaysMs?: number[];
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const MAX_RETRY_AFTER_MS = 10_000;

export function createOpenRouterClient({
  apiKey,
  appUrl,
  timeoutMs,
  retryDelaysMs = [1_000, 3_000],
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: Options): AiClient {
  async function callOnce(request: AiRequest): Promise<string> {
    if (!apiKey) throw new AiError('not_configured', 'OPENROUTER_API_KEY is not set');

    // Abort the request if the model takes too long; a hung call must never block the worker.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let res: Response;
      try {
        res = await fetchImpl(OPENROUTER_URL, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': appUrl,
            'X-Title': 'Debrief',
          },
          body: JSON.stringify(buildBody(request)),
        });
      } catch {
        throw controller.signal.aborted
          ? new AiError('timeout', `No response within ${timeoutMs / 1000}s`)
          : new AiError('unavailable', 'Could not reach OpenRouter');
      }

      const body = (await res.json().catch(() => null)) as OpenRouterBody | null;
      if (!res.ok) throw classify(res, body?.error?.message ?? '');
      // OpenRouter can answer 200 with an error object when the upstream provider fails.
      if (body?.error) throw new AiError('unavailable', body.error.message ?? 'Provider error');

      const content = body?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim() === '') {
        throw new AiError('empty', 'The model returned no content');
      }
      return content;
    } catch (err) {
      if (err instanceof AiError) throw err;
      throw controller.signal.aborted
        ? new AiError('timeout', `No response within ${timeoutMs / 1000}s`)
        : new AiError('unavailable', 'Unexpected response from OpenRouter');
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async complete(request) {
      for (let attempt = 0; ; attempt++) {
        try {
          return await callOnce(request);
        } catch (err) {
          const retryable = err instanceof AiError && RETRYABLE.has(err.kind);
          if (!retryable || attempt >= retryDelaysMs.length) throw err;
          // Exponential-ish backoff; honour the server's Retry-After when it gives one.
          await sleep(err.retryAfterMs ?? retryDelaysMs[attempt] ?? 0);
        }
      }
    },
  };
}

type OpenRouterBody = {
  choices?: { message?: { content?: unknown } }[];
  error?: { message?: string };
};

function buildBody(request: AiRequest) {
  return {
    model: request.model,
    // 0 = as deterministic as possible: we want extraction, not creativity.
    temperature: 0,
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.user },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: request.schemaName, strict: true, schema: request.jsonSchema },
    },
    // For OpenAI models, only route to OpenAI itself, so it uses my own (BYOK) OpenAI key.
    ...(request.model.startsWith('openai/') ? { provider: { only: ['openai'] } } : {}),
  };
}

function classify(res: Response, message: string): AiError {
  const status = res.status;
  if (status === 401 || status === 403)
    return new AiError('auth', 'OpenRouter rejected the API key');
  if (status === 429) {
    // The free tier's daily cap won't lift if we wait a few seconds, so don't retry it.
    if (/per[\s-]?day|daily|free-models-per-day/i.test(message)) {
      return new AiError('daily_limit', 'Daily free-model limit reached');
    }
    const seconds = Number(res.headers.get('retry-after'));
    const retryAfterMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
    return new AiError(
      'rate_limited',
      'Rate limited',
      retryAfterMs && Math.min(retryAfterMs, MAX_RETRY_AFTER_MS),
    );
  }
  if (status === 408) return new AiError('timeout', 'Upstream timeout');
  if (status >= 500) return new AiError('unavailable', `OpenRouter error ${status}`);
  // 400/402/404/422: this model can't handle the request (no structured output support,
  // removed, needs credits...). Another model might.
  return new AiError('rejected', `Model rejected the request (${status})`);
}
