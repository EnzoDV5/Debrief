// Cloudflare Worker for the web app: serves the built site and forwards /api/* to the Render api,
// so the browser only ever talks to one origin (cookies stay first-party, no CORS).

const HOP_BY_HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    if (!env.API_ORIGIN) {
      return Response.json(
        { error: { code: 'MISCONFIGURED', message: 'API_ORIGIN is not set on the Worker' } },
        { status: 503 },
      );
    }

    const target = new URL(url.pathname + url.search, env.API_ORIGIN);
    const headers = new Headers(request.headers);
    for (const name of HOP_BY_HOP) headers.delete(name);
    headers.set('X-Forwarded-Host', url.host);
    headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
    const clientIp = request.headers.get('CF-Connecting-IP');
    if (clientIp) headers.set('X-Forwarded-For', clientIp);

    const hasBody = !['GET', 'HEAD'].includes(request.method);
    try {
      // redirect: 'manual' hands the api's 302s (to Google, back to the app) straight to the
      // browser, together with their Set-Cookie headers.
      return await fetch(target, {
        method: request.method,
        headers,
        body: hasBody ? request.body : undefined,
        redirect: 'manual',
      });
    } catch {
      return Response.json(
        { error: { code: 'BAD_GATEWAY', message: "Can't reach the server. Try again shortly." } },
        { status: 502 },
      );
    }
  },
};
