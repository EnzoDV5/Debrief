import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Keep test output readable: no request logs. (Vitest sets NODE_ENV=test itself.)
    env: { LOG_LEVEL: 'silent' },
  },
});
