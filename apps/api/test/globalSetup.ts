// Runs once before the api tests: migrates the test database.
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { TEST_DATABASE_URL } from './testDatabase';

export default async function setup() {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
    });
  } finally {
    await pool.end();
  }
}
