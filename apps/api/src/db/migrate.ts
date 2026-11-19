// Applies any migrations that haven't run yet, then exits. Safe to run on every start:
// drizzle records applied migrations in its own table and skips them.
// Run with `npm run db:migrate`; the Docker api runs it before starting the server.
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { logger } from '../lib/logger';
import { db, MIGRATIONS_FOLDER, pool } from './client';

try {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  logger.info('Database migrations are up to date');
} catch (err) {
  logger.error({ err }, 'Database migration failed');
  process.exitCode = 1;
} finally {
  await pool.end();
}
