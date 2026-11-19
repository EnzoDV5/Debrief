import { healthResponseSchema } from '@debrief/shared';
import { useEffect, useState } from 'react';

type ApiState = 'loading' | 'ok' | 'error';

// Phase 0 placeholder: proves web → proxy → api works end to end.
// Replaced by real routing and TanStack Query in Phase 1.
export default function App() {
  const [apiState, setApiState] = useState<ApiState>('loading');

  useEffect(() => {
    // Abort on unmount (React StrictMode mounts twice in dev).
    const controller = new AbortController();

    fetch('/api/health', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        // Responses are untrusted too: check the shape instead of assuming it.
        healthResponseSchema.parse(data);
        setApiState('ok');
      })
      .catch(() => {
        if (!controller.signal.aborted) setApiState('error');
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-3xl font-bold">Debrief</h1>
      <p className="mt-2 text-gray-600">Meeting transcripts in, decisions and action items out.</p>

      {/* role="status" makes screen readers announce the change from loading to the result. */}
      <p role="status" className="mt-6 text-sm">
        {apiState === 'loading' && 'Checking API…'}
        {apiState === 'ok' && <span className="text-green-700">API is up</span>}
        {apiState === 'error' && <span className="text-red-700">API is unreachable</span>}
      </p>
    </main>
  );
}
