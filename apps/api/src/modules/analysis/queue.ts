// The pg-boss job queue. It lives in our own Postgres, so jobs survive a restart.
import { PgBoss } from 'pg-boss';
import type { Logger } from 'pino';
import { sslFor } from '../../db/client';
import type { AnalysisJob } from './analysis.service';

export const ANALYZE_QUEUE = 'analyze-meeting';

export interface AnalysisQueue {
  enqueue(job: AnalysisJob): Promise<void>;
}

export async function startPgBossQueue({
  connectionString,
  handler,
  log,
}: {
  connectionString: string;
  handler: (job: AnalysisJob) => Promise<void>;
  log: Pick<Logger, 'info' | 'error'>;
}) {
  const boss = new PgBoss({ connectionString, ssl: sslFor(connectionString), max: 4 });
  boss.on('error', (err) => log.error({ err }, 'pg-boss error'));
  await boss.start();

  if (!(await boss.getQueue(ANALYZE_QUEUE))) {
    await boss.createQueue(ANALYZE_QUEUE, {
      policy: 'stately',
      retryLimit: 2,
      retryDelay: 30,
      retryBackoff: true,
      expireInSeconds: 600,
    });
  }

  await boss.work<AnalysisJob>(ANALYZE_QUEUE, async (jobs) => {
    for (const job of jobs) await handler(job.data);
  });
  log.info('Analysis worker started');

  return {
    async enqueue(job: AnalysisJob) {
      // One job per meeting at a time, even if Retry is clicked twice.
      await boss.send(ANALYZE_QUEUE, job, { singletonKey: job.meetingId });
    },
    async stop() {
      await boss.stop({ graceful: true, timeout: 10_000 });
    },
  };
}
