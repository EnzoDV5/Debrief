import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './test/testDatabase.ts';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/globalSetup.ts'],
    // Test files share one database and reset it between tests, so run files one at a time.
    fileParallelism: false,
    env: {
      // Keep test output readable: no request logs. (Vitest sets NODE_ENV=test itself.)
      LOG_LEVEL: 'silent',
      DATABASE_URL: TEST_DATABASE_URL,
    },
  },
});
