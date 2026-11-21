// Test settings for the api: one shared test database, set up once.
import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './test/testDatabase.ts';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/globalSetup.ts'],
    fileParallelism: false,
    env: {
      LOG_LEVEL: 'silent',
      DATABASE_URL: TEST_DATABASE_URL,
    },
  },
});
