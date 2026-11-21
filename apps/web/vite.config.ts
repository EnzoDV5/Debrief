/// <reference types="vitest/config" />
// Vite settings: React, Tailwind, the /api proxy in dev, and tests.
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': '/src' },
  },
  build: {
    rolldownOptions: {
      output: {
        // Libraries change far less often than our code. Keeping them in their own files means a
        // deploy doesn't make returning visitors download React and friends again.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
            },
            {
              name: 'data',
              test: /node_modules[\\/](@tanstack|zod|react-hook-form|@hookform)[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
