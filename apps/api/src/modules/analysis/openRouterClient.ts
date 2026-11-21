// Talks to OpenRouter with timeouts and retries. Only the server calls it, so the key stays secret.
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
  schemaName: string;
  jsonSchema: Record<string, unknown>;
};

export interface AiClient {
  complete(request: AiRequest): Promise<string>;
}

type Options = {
  apiKey: string | undefined;
  appUrl: string;
  timeoutMs: number;
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
    temperature: 0,
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.user },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: request.schemaName, strict: true, schema: request.jsonSchema },
    },
    // OpenAI models go straight to OpenAI, so they run on our own key.
    ...(request.model.startsWith('openai/') ? { provider: { only: ['openai'] } } : {}),
  };
}

function classify(res: Response, message: string): AiError {
  const status = res.status;
  if (status === 401 || status === 403)
    return new AiError('auth', 'OpenRouter rejected the API key');
  if (status === 429) {
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
  return new AiError('rejected', `Model rejected the request (${status})`);
}
