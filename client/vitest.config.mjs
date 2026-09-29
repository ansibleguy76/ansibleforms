import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    dedupe: ['vue', 'yaml'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@engine': fileURLToPath(new URL('../server/src/lib/formEngine', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
  },
});
