import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@config': path.resolve(__dirname, 'config'),
      '@lib': path.resolve(__dirname, 'src/lib'),
    },
  },
  test: {
    globals: true,
  },
});
