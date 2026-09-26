import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { sitePlugin } from './build/site-plugin';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), sitePlugin()],
  build: {
    target: 'es2022',
    // Keep SVG thumbnails as cacheable files instead of inlining them into JS.
    assetsInlineLimit: (file) => (file.endsWith('.svg') ? false : undefined),
    sourcemap: false,
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react';
          return undefined;
        },
      },
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
