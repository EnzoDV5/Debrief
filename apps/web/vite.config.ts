/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `@/components/ui/Button` instead of `../../../components/ui/Button`. Mirrored in tsconfig.json.
  resolve: {
    alias: { '@': '/src' },
  },
  server: {
    port: 5173,
    // The browser only ever talks to its own origin; Vite forwards /api to the Express server.
    // Production does the same with a Vercel rewrite, so session cookies stay first-party
    // (SameSite=Lax would block them if web and api were on different sites).
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
