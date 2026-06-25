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
    environment: 'node',
    alias: {
      '../lib/cmd.js': new URL('./tests/__mocks__/cmd.js', import.meta.url).pathname,
      '../lib/logger.js': new URL('./tests/__mocks__/logger.js', import.meta.url).pathname,
      '../../config/app.config.js': new URL('./tests/__mocks__/app.config.js', import.meta.url).pathname,
    },
  },
});
