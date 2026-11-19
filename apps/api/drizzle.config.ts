import { defineConfig } from 'drizzle-kit';

// Used by `npm run db:generate` to turn changes in schema.ts into a new SQL migration file.
// Generating doesn't connect to a database; the url is only needed for drizzle-kit studio.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
});
