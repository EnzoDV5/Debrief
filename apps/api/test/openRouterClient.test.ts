// The OpenRouter client: timeouts, retries and error handling.
import { describe, expect, it, vi } from 'vitest';
import {
  AiError,
  createOpenRouterClient,
  type AiRequest,
} from '../src/modules/analysis/openRouterClient';

const request: AiRequest = {
  model: 'test/model:free',
  system: 'sys',
  user: 'user',
  schemaName: 'thing',
  jsonSchema: { type: 'object' },
};

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}
const ok = (content: string) => respond(200, { choices: [{ message: { content } }] });

function setup(responses: Array<Response | Error>, options: { timeoutMs?: number } = {}) {
  const fetchImpl = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('no more scripted responses');
    if (next instanceof Error) throw next;
    return next;
  });
  const sleeps: number[] = [];
  const client = createOpenRouterClient({
    apiKey: 'test-key',
    appUrl: 'http://localhost:5173',
    timeoutMs: options.timeoutMs ?? 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { client, fetchImpl, sleeps };
}

async function failureOf(promise: Promise<unknown>): Promise<AiError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof AiError) return err;
    throw err;
  }
  throw new Error('expected the call to fail');
}

describe('OpenRouter client', () => {
  it('sends a strict JSON-schema request and returns the content', async () => {
    const { client, fetchImpl } = setup([ok('{"a":1}')]);

    expect(await client.complete(request)).toBe('{"a":1}');

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      model: 'test/model:free',
      temperature: 0,
      response_format: { type: 'json_schema', json_schema: { name: 'thing', strict: true } },
    });
    expect(body).not.toHaveProperty('provider');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
  });

  it('pins openai/ models to OpenAI so my own key is used', async () => {
    const { client, fetchImpl } = setup([ok('{}')]);
    await client.complete({ ...request, model: 'openai/gpt-5-mini' });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).provider).toEqual({ only: ['openai'] });
  });

  it('retries 429 and 5xx with backoff, then succeeds', async () => {
    const { client, sleeps } = setup([
      respond(429, { error: { message: 'Rate limit exceeded' } }),
      respond(503, { error: { message: 'busy' } }),
      ok('{"ok":true}'),
    ]);

    expect(await client.complete(request)).toBe('{"ok":true}');
    expect(sleeps).toEqual([1000, 3000]);
  });

  it('honours Retry-After (capped at 10s)', async () => {
    const { client, sleeps } = setup([
      respond(429, { error: { message: 'slow down' } }, { 'retry-after': '4' }),
      ok('{}'),
    ]);
    await client.complete(request);
    expect(sleeps).toEqual([4000]);
  });

  it('gives up after two retries', async () => {
    const { client, fetchImpl } = setup([respond(502, {}), respond(502, {}), respond(502, {})]);
    expect((await failureOf(client.complete(request))).kind).toBe('unavailable');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('does not retry the free daily limit', async () => {
    const { client, fetchImpl } = setup([
      respond(429, { error: { message: 'Rate limit exceeded: free-models-per-day' } }),
    ]);
    expect((await failureOf(client.complete(request))).kind).toBe('daily_limit');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [400, 'rejected'],
    [402, 'rejected'],
    [404, 'rejected'],
  ])('maps HTTP %i to %s without retrying', async (status, kind) => {
    const { client, fetchImpl } = setup([respond(status, { error: { message: 'x' } })]);
    expect((await failureOf(client.complete(request))).kind).toBe(kind);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('treats a 200 with an error body or empty content as failures', async () => {
    const providerError = setup([respond(200, { error: { message: 'upstream died' } }), ok('{}')]);
    expect(await providerError.client.complete(request)).toBe('{}');

    const empty = setup([ok('   ')]);
    expect((await failureOf(empty.client.complete(request))).kind).toBe('empty');
  });

  it('aborts a call that takes longer than the timeout', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const client = createOpenRouterClient({
      apiKey: 'k',
      appUrl: 'http://x',
      timeoutMs: 20,
      retryDelaysMs: [],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect((await failureOf(client.complete(request))).kind).toBe('timeout');
  });

  it('refuses to call without an API key', async () => {
    const client = createOpenRouterClient({ apiKey: undefined, appUrl: 'http://x', timeoutMs: 10 });
    expect((await failureOf(client.complete(request))).kind).toBe('not_configured');
  });
});
