// Runs any database migrations that haven't been applied yet, then exits.
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { createPool, MIGRATIONS_FOLDER, pool as defaultPool } from './client';

const toSupabase = process.argv.includes('--supabase');
if (toSupabase && !env.SUPABASE_DATABASE_URL) {
  logger.error('SUPABASE_DATABASE_URL is not set in .env');
  process.exit(1);
}

const pool =
  toSupabase && env.SUPABASE_DATABASE_URL ? createPool(env.SUPABASE_DATABASE_URL) : defaultPool;
const target = toSupabase ? 'Supabase' : 'DATABASE_URL';

try {
  await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  logger.info(`Database migrations are up to date (${target})`);
} catch (err) {
  logger.error({ err }, `Database migration failed (${target})`);
  process.exitCode = 1;
} finally {
  await pool.end();
  if (pool !== defaultPool) await defaultPool.end();
}
