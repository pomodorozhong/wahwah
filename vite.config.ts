import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    // Three.js alone is ~550 kB minified; one chunk is fine for a local prototype.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        klattsch: resolve(import.meta.dirname, 'klattsch/index.html'),
        babble: resolve(import.meta.dirname, 'babble/index.html'),
        live: resolve(import.meta.dirname, 'live/index.html'),
      },
    },
  },
  test: {
    environment: 'node',
    // pink-trombone-mod uses extensionless relative imports that plain Node ESM
    // cannot resolve; let Vite transform it.
    server: { deps: { inline: ['pink-trombone-mod'] } },
  },
});
