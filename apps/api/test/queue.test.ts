import { describe, expect, it } from 'vitest';
import { startPgBossQueue } from '../src/modules/analysis/queue';
import { TEST_DATABASE_URL } from './testDatabase';

const log = { info: () => {}, error: () => {} } as const;

describe('pg-boss analysis queue', () => {
  it('creates the queue, delivers a job, and starts again with the existing queue', async () => {
    const delivered: string[] = [];
    const first = await startPgBossQueue({
      connectionString: TEST_DATABASE_URL,
      handler: async (job) => {
        delivered.push(job.meetingId);
      },
      log,
    });
    try {
      const meetingId = crypto.randomUUID();
      await first.enqueue({ meetingId, userId: crypto.randomUUID() });
      await expect.poll(() => delivered, { timeout: 10_000 }).toContain(meetingId);
    } finally {
      await first.stop();
    }

    const restarted = await startPgBossQueue({
      connectionString: TEST_DATABASE_URL,
      handler: async () => {},
      log,
    });
    await restarted.stop();
  });
});
