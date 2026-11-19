import { PgBoss } from 'pg-boss';
import type { Logger } from 'pino';
import { sslFor } from '../../db/client';
import type { AnalysisJob } from './analysis.service';

export const ANALYZE_QUEUE = 'analyze-meeting';

/** What the web side needs: "please analyse this meeting". Tests pass a fake that records jobs. */
export interface AnalysisQueue {
  enqueue(job: AnalysisJob): Promise<void>;
}

/**
 * pg-boss keeps jobs in our own Postgres (its own `pgboss` schema), so no extra service like
 * Redis is needed, and a queued job survives a server restart.
 */
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
      // "stately": at most one queued and one running job per meeting (singletonKey below),
      // so double-clicking Retry can't start the same analysis twice.
      policy: 'stately',
      // Our handler handles AI failures itself (marks the meeting 'failed'). pg-boss retries are
      // for the process dying mid-job: the job expires and runs again.
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
      await boss.send(ANALYZE_QUEUE, job, { singletonKey: job.meetingId });
    },
    async stop() {
      await boss.stop({ graceful: true, timeout: 10_000 });
    },
  };
}
