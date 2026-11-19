// Public entry point: web and api import from '@debrief/shared', never from deep paths.
// The package exports TypeScript source directly (no build step): tsx and Vite compile it.
export * from './schemas/health';
