// Points the tests at the local Docker test database, never Supabase.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://debrief:debrief@localhost:5432/debrief_test';

const { hostname, pathname } = new URL(TEST_DATABASE_URL);
if (!['localhost', '127.0.0.1', 'db'].includes(hostname) || !pathname.endsWith('_test')) {
  throw new Error('Refusing to run tests: TEST_DATABASE_URL must be a local *_test database');
}
