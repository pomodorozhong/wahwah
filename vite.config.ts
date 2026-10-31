import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Three.js alone is ~550 kB minified; one chunk is fine for a local prototype.
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
  },
});
