import { defineConfig } from 'vitest/config';

// Runs the package tests on their own. The playground's config loads the WASM
// voices first, which a release build does not have.
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
